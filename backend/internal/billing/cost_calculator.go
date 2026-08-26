// Package billing 是计费计算的纯函数层。
//
// 职责：按 BillingMode 派发算价，不含 provider 分支，不访问 repo / DB。
// 创建侧（service.newBillingOrder）传预估量，结算侧（repository.SettleBillingOrder）
// 传真实 usage，两者共享同一份 token 算价实现，避免近似实现漂移。
//
// 设计约束（阶段 1）：
//   - 取整分母不可统一。CreditAmount 分母 10_000（multiplierBPS 基点）；
//     TokenAmount 分母 10_000_000_000（基点 × 每百万 token 口径）。
//   - 行为与重构前字节级等价，不新增 BillingMode 值，不改表结构。
package billing

import (
	"encoding/json"
	"errors"
	"fmt"
)

// 计费方式：与 service.ChannelModel.BillingMode 字面量保持一致。
// 阶段 1 落地 fixed_request/per_second/token，阶段 2 通过 PricingConfig + Config 字段扩展 per_video_bucket。
const (
	ModeFixedRequest    = "fixed_request"    // 按次计费，quantity 恒为 1
	ModePerSecond       = "per_second"       // 按秒计费，quantity = 视频时长
	ModeToken           = "token"            // 按 token 计费，input/output/cached 三费率
	ModePerVideoBucket  = "per_video_bucket" // 视频离散档计费，按 bucket key 查价（适配不同模型时长×分辨率组合）
)

// PricingParams 是计算器的统一入参。
// 创建侧传预估量（CachedTokens=0），结算侧传真实量（CachedTokens 来自 usage）。
// 平铺字段对应 model.ChannelModel 的 4 个价格字段，覆盖旧三种 BillingMode；
// 形状特定参数（如 per_video_bucket 的 buckets + bucket key）放 Config，旧三种 mode 不用此字段。
type PricingParams struct {
	BillingMode   string         // fixed_request | per_second | token | per_video_bucket
	UnitPrice     int64          // 按次/按秒单价（microcredits），对应 ChannelModel.UnitPriceMicrocredits
	Quantity      int64          // 按次=1，按秒=时长秒数
	InputTokens   int64          // token 模式输入 token（已减 cached，由调用方处理）
	OutputTokens  int64          // token 模式输出 token
	CachedTokens  int64          // token 模式缓存 token（结算侧用；创建侧预估传 0）
	InputPrice    int64          // 每百万 token 输入价（microcredits）
	OutputPrice   int64          // 每百万 token 输出价（microcredits）
	CachedPrice   int64          // 每百万 token 缓存价（microcredits）
	MultiplierBPS int64          // 乘数倍率（基点，1 基点 = 1/10000）
	Config        map[string]any // 形状特定参数；per_video_bucket 用 buckets + bucket；旧三种 mode 留空
}

// CalculateCost 按 BillingMode 派发算价，返回 microcredits 金额。
// 纯函数，不访问 repo / DB；溢出和参数非法返回 error。
// 新增定价形状时在此处加 case，调用方无需改动。
func CalculateCost(params PricingParams) (int64, error) {
	switch params.BillingMode {
	case ModeFixedRequest:
		return CreditAmount(params.UnitPrice, 1, params.MultiplierBPS)
	case ModePerSecond:
		return CreditAmount(params.UnitPrice, params.Quantity, params.MultiplierBPS)
	case ModeToken:
		return TokenAmount(
			params.InputTokens, params.OutputTokens, params.CachedTokens,
			params.InputPrice, params.OutputPrice, params.CachedPrice,
			params.MultiplierBPS,
		)
	case ModePerVideoBucket:
		return calculateVideoBucket(params.Config)
	default:
		return 0, fmt.Errorf("billing: unsupported billing mode %q", params.BillingMode)
	}
}

// calculateVideoBucket 按 bucket key 在 buckets 中查价。
// bucket key 由调用方（service.newBillingOrder）按 bucketKeyFields 从 payload 提取拼接后，
// 放在 Config["bucket"] 传入。本函数只负责查价，不负责解析 payload，便于纯函数测试。
// 离散档是预授权即终值（与 fixed_request 语义一致）：不乘 multiplier，
// multiplier 已体现在管理员配置的 bucket 价格里，避免对档位价再次叠加倍率。
// 找不到档位或价格非法返回 error，不静默 fallback，避免免费生成。
func calculateVideoBucket(config map[string]any) (int64, error) {
	if config == nil {
		return 0, errors.New("视频离散档计费缺少配置")
	}
	buckets, _ := config["buckets"].(map[string]any)
	if len(buckets) == 0 {
		return 0, errors.New("视频离散档计费未配置档位价格")
	}
	bucket, _ := config["bucket"].(string)
	if bucket == "" {
		return 0, errors.New("视频离散档计费未匹配到档位")
	}
	price, ok := buckets[bucket]
	if !ok {
		return 0, fmt.Errorf("视频离散档计费档位 %q 未配置价格", bucket)
	}
	priceMicro, ok := toInt64(price)
	if !ok || priceMicro <= 0 {
		return 0, fmt.Errorf("视频离散档计费档位 %q 价格无效", bucket)
	}
	return priceMicro, nil
}

// toInt64 把 JSON 反序列化后的数字值转回 int64。
// encoding/json 默认把 number 解成 float64，GORM 读取 map[string]any 时同样如此；
// 也兼容 json.Number 与裸 int64（部分 provider 路径会显式构造）。
// 失败返回 (0, false)，由调用方按业务语义报错，避免静默吞掉无效配置。
func toInt64(value any) (int64, bool) {
	switch v := value.(type) {
	case int64:
		return v, true
	case int:
		return int64(v), true
	case float64:
		if v != float64(int64(v)) {
			return 0, false
		}
		return int64(v), true
	case json.Number:
		parsed, err := v.Int64()
		if err != nil {
			return 0, false
		}
		return parsed, true
	}
	return 0, false
}

// CreditAmount 是按次/按秒计费的算价核心。
// 单价、数量和倍率全程使用整数并向上取整，避免浮点误差造成少扣积分。
// 分母 10_000 对应 multiplierBPS 的基点口径（1 基点 = 1/10000）。
func CreditAmount(unitPrice int64, quantity int64, multiplierBPS int64) (int64, error) {
	if unitPrice < 0 || quantity <= 0 || multiplierBPS <= 0 {
		return 0, errors.New("积分计费参数无效")
	}
	if unitPrice > (1<<63-1)/quantity {
		return 0, errors.New("积分计费金额溢出")
	}
	base := unitPrice * quantity
	if base > ((1<<63-1)-9_999)/multiplierBPS {
		return 0, errors.New("积分计费金额溢出")
	}
	amount := (base*multiplierBPS + 9_999) / 10_000
	if amount < 0 {
		return 0, fmt.Errorf("积分计费金额无效：%d", amount)
	}
	return amount, nil
}

// TokenAmount 是 token 计费的共享算价核心。
// input tokens 已由调用方减去 cached（创建侧预估传 cached=0）；
// output tokens 原样传入。cached tokens 单独按 CachedPrice 计费。
// 创建侧（service.newBillingOrder）和结算侧（repository.tokenUsageAmount）都走这里，
// 消除原本 service.tokenEstimateAmount / repository.tokenUsageAmount 两份近似实现。
//
// 溢出检查顺序对齐原 repository.tokenUsageAmount：
//   1. input×price、output×price 各自安全乘
//   2. inputAmount+outputAmount 不溢出
//   3. cached×price 安全乘，且 (inputAmount+outputAmount)+cachedAmount 不溢出
//   4. base×multiplierBPS 不溢出
//
// 分母 10_000_000_000 = 1_000_000（token→每百万口径）× 10_000（multiplierBPS 基点）。
// 与 CreditAmount 的 10_000 分母不可统一，否则会改变取整结果。
//
// 注意：output<=0 的语义校验由调用方负责（service 侧 newBillingOrder 预校验，
// repository 侧 tokenUsageAmount 对 video 校验）。本函数只防负数，不做业务语义校验，
// 避免改变 repository 侧 text 模式 output=0 的边界行为。
func TokenAmount(input, output, cached, inPrice, outPrice, cachedPrice, multiplierBPS int64) (int64, error) {
	if input < 0 || output < 0 || cached < 0 {
		return 0, errors.New("Token 计费参数无效")
	}
	inputAmount, ok := safeTokenProduct(input, inPrice)
	if !ok {
		return 0, errors.New("Token 计费金额溢出")
	}
	outputAmount, ok := safeTokenProduct(output, outPrice)
	if !ok || inputAmount > 1<<63-1-outputAmount {
		return 0, errors.New("Token 计费金额溢出")
	}
	cachedAmount, ok := safeTokenProduct(cached, cachedPrice)
	base := inputAmount + outputAmount
	if !ok || base > 1<<63-1-cachedAmount {
		return 0, errors.New("Token 计费金额溢出")
	}
	base += cachedAmount
	if multiplierBPS <= 0 || base > (1<<63-1-9_999_999_999)/multiplierBPS {
		return 0, errors.New("Token 计费金额溢出")
	}
	amount := (base*multiplierBPS + 9_999_999_999) / 10_000_000_000
	if amount <= 0 {
		return 0, errors.New("Token 计费金额必须大于 0")
	}
	return amount, nil
}

// safeTokenProduct 是 token 数量与单价的溢出安全乘法。
// 合并自原 service.safeTokenProduct 与 repository.safeTokenUsageProduct，
// 两者实现字节级一致，此处统一为一份。
func safeTokenProduct(tokens int64, price int64) (int64, bool) {
	if tokens < 0 || price < 0 || (tokens > 0 && price > (1<<63-1)/tokens) {
		return 0, false
	}
	return tokens * price, true
}
