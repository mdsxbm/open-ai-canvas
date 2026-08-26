# 规格文档：计费计算器解耦与 provider 特判消除（阶段 1）

> 产物所属 Spec 目录：`.trae/specs/billing-cost-calculator/`
> 自然语言：中文
> 关联仓库：影策 AI 影视创作工作台（`backend/` Go + Gin + GORM）
> 阶段定位：多模型 + 计费重构的第 1 阶段，纯内部重构，零行为变更，零 UI / 前端合同影响。

---

## 0. 背景摘要（问题、用户、目标、非目标）

### 0.1 问题
当前计费计算逻辑耦合在订单创建路径里，且混入了 provider 特判：

- [backend/internal/service/finance.go](file:///workspace/backend/internal/service/finance.go) 的 `newBillingOrder` 在 [L571-L596](file:///workspace/backend/internal/service/finance.go#L571-L596) 用 `switch item.BillingMode` 直接算价，订单组装和计费耦合在同一函数；后续新增定价形状（按分辨率分档图像、视频离散档、TTS 按字符等）只能继续往这个 switch 里堆 `case`，且每个 `case` 都会重复「校验 + 算价 + 装订单」三件事。
- provider 特判散落两处：
  - [channel_models.go:228-230](file:///workspace/backend/internal/service/channel_models.go#L228-L230) 的 `supportsTokenBilling` 把 `capability == "video" && protocol == 火山方舟视频` 硬编码进计费能力判断；
  - [finance.go:583-593](file:///workspace/backend/internal/service/finance.go#L583-L593) 的 token 模式又对 `capability == "video"` 单独走 `estimateArkVideoTokens`，对文本走 `estimateTaskTokens`，provider 分支塞进通用计费路径。
- 结算侧重算在 [repository/finance.go:616-645](file:///workspace/backend/internal/repository/finance.go#L616-L645) 的 `tokenUsageAmount`，与创建侧 `tokenEstimateAmount`（[finance.go:755-776](file:///workspace/backend/internal/service/finance.go#L755-L776)）是两份近似但不共享的 token 算价实现，后续扩展形状时两边都要改，容易漏。

### 0.2 目标用户
- 后端开发者：后续接入新 provider / 新定价形状时，有单一计算入口可扩展，不需要同时改 service + repository 两处算价。
- 运营管理员：定价形状后续可按 provider 粒度配置，不受协议类型硬编码限制。

### 0.3 目标（Goal）
**把计费计算从订单创建路径解耦成独立计算器，消除 provider 协议特判，行为完全等价于现状。**

具体交付：
1. 新增 `backend/internal/service/cost_calculator.go`，定义 `PricingParams` 入参 + 按 `BillingMode` 派发的 `CalculateCost` 函数；
2. `newBillingOrder` 只负责组装 `BillingOrder`，计价委托给计算器；
3. `supportsTokenBilling` 的 `火山方舟视频协议` 硬编码改为由形状 kind 决定（本阶段先用映射表替代硬编码，不引入新表/新字段）；
4. 结算侧 `tokenUsageAmount` 保持原位（repository 层事务内调用），但抽出共享的 token 算价纯函数供创建侧和结算侧复用，消除两份近似实现；
5. 现有三种 `BillingMode`（`fixed_request` / `per_second` / `token`）行为字节级等价，所有现有测试通过。

### 0.4 非目标（Non-Goal）
- **不新增定价形状**：不引入 `per_image_by_resolution` / `per_video_bucket` / `per_character` 等，留给阶段 2；
- **不改表结构**：`ChannelModel` 不加字段，`BillingOrder` 不加字段，`ApiCallLog` 不加字段，不做数据库迁移；
- **不改前端合同**：`ChannelModelRequest` / `BillingOrder` 的 JSON 字段名和含义不变，前端模型编辑 UI、钱包页、计费订单页零改动；
- **不改计费策略**：乘数倍率（`MultiplierBasisPoints`）、向上取整规则、token 预估口径（`estimateArkVideoTokens` 的像素帧公式）、结算多退少补逻辑全部保持原样；
- **不重构预估层**：`estimateTaskTokens` / `estimateArkVideoTokens` / `estimateProxyTokens` / `arkVideoOutputPixels` 这些 token 预估函数保持在原位，它们是「输入」不是「计价」，不属于计算器职责；
- **不动 `CreditPolicy`**：`creditPolicy()` / `DefaultMultiplierBPS` / `ModelMultiplierBPS` 保持原样；
- **不动人工核对流程**：`ResolveBillingOrder` / `MarkBillingUncertain` / `BillingFailureRequiresReview` 保持原样。

---

## 1. 现状代码地图

### 1.1 创建侧算价（service 层）
- [finance.go:557-622](file:///workspace/backend/internal/service/finance.go#L557-L622) `newBillingOrder`：组装 `BillingOrder`，内含 `switch item.BillingMode` 算价。
- [finance.go:624-685](file:///workspace/backend/internal/service/finance.go#L624-L685) `estimateTaskTokens` / `estimateTaskBillingTokens` / `estimateArkVideoTokens` / `arkVideoOutputPixels`：token 预估（输入层，不动）。
- [finance.go:724-728](file:///workspace/backend/internal/service/finance.go#L724-L728) `estimateProxyTokens`：代理请求 token 预估（不动）。
- [finance.go:755-783](file:///workspace/backend/internal/service/finance.go#L755-L783) `tokenEstimateAmount` / `safeTokenProduct`：创建侧 token 算价（要抽共享）。
- [credit_policy.go:152-168](file:///workspace/backend/internal/service/credit_policy.go#L152-L168) `creditAmount`：按次/按秒算价（不动签名，计算器内部复用）。

### 1.2 结算侧重算（repository 层）
- [repository/finance.go:449-475](file:///workspace/backend/internal/repository/finance.go#L449-L475) `SettleBillingOrder`：token 模式结算时拉真实 usage 重算。
- [repository/finance.go:616-652](file:///workspace/backend/internal/repository/finance.go#L616-L652) `tokenUsageAmount` / `safeTokenUsageProduct`：结算侧 token 算价（要抽共享）。

### 1.3 provider 特判
- [channel_models.go:228-230](file:///workspace/backend/internal/service/channel_models.go#L228-L230) `supportsTokenBilling`：`capability == "text" || (capability == "video" && protocol == 火山方舟视频)`。
- [channel_models.go:155-157](file:///workspace/backend/internal/service/channel_models.go#L155-L157) `SaveAdminChannelModel` 校验：`Token 计费仅支持文本模型和火山方舟视频协议`。
- [finance.go:583-593](file:///workspace/backend/internal/service/finance.go#L583-L593) `newBillingOrder`：`capability == "video"` 单独走 `estimateArkVideoTokens`。

### 1.4 校验路径
- [channel_models.go:145-170](file:///workspace/backend/internal/service/channel_models.go#L145-L170) `SaveAdminChannelModel`：`BillingMode` 合法性 + 价格非负 + token 至少一项价格。

---

## 2. 目标结构

### 2.1 新文件 `backend/internal/service/cost_calculator.go`

职责：按 `BillingMode` 派发计价，不含 provider 分支，不含订单组装。

```go
package service

// PricingParams 是计算器的统一入参。
// 创建侧传预估量（estimate），结算侧传真实量（usage）；字段语义不变，
// 仅是把散落在 newBillingOrder / tokenEstimateAmount / tokenUsageAmount 的入参收敛到一个结构。
type PricingParams struct {
    BillingMode  string  // fixed_request | per_second | token
    Capability   string  // text | image | video | audio
    UnitPrice    int64   // 按次/按秒单价（microcredits）
    Quantity     int64   // 按次=1，按秒=时长，token=InputTokens+OutputTokens
    InputTokens  int64
    OutputTokens int64
    CachedTokens int64   // 结算侧用；创建侧预估时为 0
    InputPrice   int64   // 每百万 token 输入价
    OutputPrice  int64   // 每百万 token 输出价
    CachedPrice  int64   // 每百万 token 缓存价
    MultiplierBPS int64  // 乘数倍率
}

// CalculateCost 按 BillingMode 派发，返回 microcredits 金额。
// 纯函数，不访问 repo / DB；溢出和参数非法返回 error。
func CalculateCost(params PricingParams) (int64, error)
```

内部按 `BillingMode` 派发到三个纯函数：
- `calculateFixedRequest` → 复用 `creditAmount`
- `calculatePerSecond` → 复用 `creditAmount`（quantity=时长）
- `calculateToken` → 复用抽出的共享 token 算价函数

### 2.2 共享 token 算价函数

把 `tokenEstimateAmount`（service）和 `tokenUsageAmount`（repository）的算价核心抽到一个纯函数，放在 `cost_calculator.go`：

```go
// tokenAmount 是 token 计费的共享算价核心。
// 输入 tokens 已减去 cached（由调用方处理），输出 tokens 原样传入。
// 创建侧和结算侧都走这里，消除两份近似实现。
func tokenAmount(input, output, cached int64, inPrice, outPrice, cachedPrice, multiplierBPS int64) (int64, error)
```

- 创建侧（`newBillingOrder`）：`input = estimate.InputTokens, output = estimate.OutputTokens, cached = 0`（预估不用缓存价）。
- 结算侧（`tokenUsageAmount`）：`input = usage.InputTokens - usage.CachedTokens, output = usage.OutputTokens, cached = usage.CachedTokens`。

原 `safeTokenProduct`（service）和 `safeTokenUsageProduct`（repository）合并为一个 `safeTokenProduct`，放 `cost_calculator.go`。

### 2.3 `newBillingOrder` 改造

[finance.go:557-622](file:///workspace/backend/internal/service/finance.go#L557-L622) 只保留：
1. 拉模型配置（`repo.ChannelModelByKey`）；
2. 校验 `PriceConfigured`、即梦视频时长档位（[L568-570](file:///workspace/backend/internal/service/finance.go#L568-L570)）；
3. 按 `BillingMode` 校验能力匹配（原本散在 switch 各 case 的校验抽到 `validateBillingMode`）；
4. 组装 `BillingOrder`，金额由 `CalculateCost` 计算。

`switch item.BillingMode` 整段移除，金额计算改为：
```go
amount, err := CalculateCost(PricingParams{
    BillingMode: item.BillingMode,
    Capability:  capability,
    UnitPrice:   item.UnitPriceMicrocredits,
    Quantity:    quantity,
    InputTokens: tokenEstimate.InputTokens,
    OutputTokens: tokenEstimate.OutputTokens,
    InputPrice:  item.InputTokenPriceMicrocredits,
    OutputPrice: item.OutputTokenPriceMicrocredits,
    CachedPrice: item.CachedTokenPriceMicrocredits,
    MultiplierBPS: multiplierBPS,
})
```

### 2.4 `supportsTokenBilling` 改造

[channel_models.go:228-230](file:///workspace/backend/internal/service/channel_models.go#L228-L230) 改为按形状 kind 决定，本阶段用映射表替代硬编码：

```go
// tokenBillingProtocols 列出当前支持 token 计费的 (capability, protocol) 组合。
// 阶段 1 只是把硬编码改为数据表，语义不变；阶段 2 引入 PricingConfig 后改为按 kind 判断。
var tokenBillingProtocols = map[string]map[model.ChannelInterfaceType]bool{
    "text": {model.ChannelInterfaceChatCompletion: true, model.ChannelInterfaceOpenAIResponse: true},
    "video": {model.ChannelInterfaceVolcengineArkVideo: true},
}

func supportsTokenBilling(capability string, protocol model.ChannelInterfaceType) bool {
    return tokenBillingProtocols[capability][protocol]
}
```

[finance.go:583-593](file:///workspace/backend/internal/service/finance.go#L583-L593) 的 `capability == "video"` 分支保留（因为视频 token 预估口径确实不同），但注释改为「视频 token 预估用像素帧公式，文本用字符数估算」，明确这是预估层差异不是计费层 provider 特判。

### 2.5 结算侧 `tokenUsageAmount` 改造

[repository/finance.go:616-645](file:///workspace/backend/internal/repository/finance.go#L616-L645) 改为调用共享的 `tokenAmount`：

```go
func tokenUsageAmount(order model.BillingOrder, usage *BillingUsage) (int64, error) {
    if usage == nil {
        return 0, ErrBillingUsageUnavailable
    }
    if order.Capability == "video" && usage.OutputTokens <= 0 {
        return 0, ErrBillingUsageUnavailable
    }
    input := usage.InputTokens - usage.CachedTokens
    if input < 0 {
        input = 0
    }
    return tokenAmount(input, usage.OutputTokens, usage.CachedTokens,
        order.InputTokenPriceMicrocredits, order.OutputTokenPriceMicrocredits,
        order.CachedTokenPriceMicrocredits, order.MultiplierBasisPoints)
}
```

`tokenAmount` / `safeTokenProduct` 放 service 包，repository 通过 import service 包调用。**注意循环依赖**：repository 当前不 import service，需确认是否引入。若引入有循环依赖风险，备选方案是把 `tokenAmount` / `safeTokenProduct` 放到 `internal/model` 或新建 `internal/billing` 纯函数包，service 和 repository 都 import 它。**实施时先验证依赖方向，优先用独立纯函数包避免循环。**

---

## 3. 行为等价性证明

| 场景 | 现状 | 改造后 | 等价 |
|---|---|---|---|
| `fixed_request` | `creditAmount(unitPrice, 1, multiplierBPS)` | `CalculateCost` → `calculateFixedRequest` → `creditAmount(unitPrice, 1, multiplierBPS)` | 是 |
| `per_second` 视频 | `creditAmount(unitPrice, durationSeconds, multiplierBPS)` | `CalculateCost` → `calculatePerSecond` → `creditAmount(unitPrice, durationSeconds, multiplierBPS)` | 是 |
| `token` 文本（创建） | `tokenEstimateAmount(item, estimate, multiplierBPS)` | `CalculateCost` → `calculateToken` → `tokenAmount(input, output, 0, ...)` | 是（cached=0 等价原实现） |
| `token` 视频（创建） | 同上，`estimateArkVideoTokens` 先算 | 同上，预估层不变 | 是 |
| `token`（结算） | `tokenUsageAmount(order, usage)` | `tokenUsageAmount` → `tokenAmount(input, output, cached, ...)` | 是 |
| `supportsTokenBilling` | 硬编码 if | 映射表查表 | 是（表内容等价） |

---

## 4. 验证方式

### 4.1 单元测试（新增）
- `cost_calculator_test.go`：对 `CalculateCost` 三种 mode 各覆盖正常值、零值、溢出、参数非法。
- `tokenAmount` 共享函数：覆盖 cached > 0 的结算路径，确认与原 `tokenUsageAmount` 字节级等价。

### 4.2 现有测试回归
- [admin_channel_test.go](file:///workspace/backend/internal/service/admin_channel_test.go)：模型保存校验。
- [task_security_test.go](file:///workspace/backend/internal/service/task_security_test.go)：计费订单创建。
- [desktop_local_channel_flow_test.go](file:///workspace/backend/internal/service/desktop_local_channel_flow_test.go)：本地渠道流程。
- [repository/finance_token_test.go](file:///workspace/backend/internal/repository/finance_token_test.go)：token 结算。
- 运行：`cd backend && go test ./internal/service/... ./internal/repository/...`

### 4.3 不运行的验证（按 AGENTS.md §9）
- 不跑 build、不跑 lint、不启动 dev server；
- 交付时明确说明未运行验证，由用户决定何时跑 `go test`。

---

## 5. 风险与回滚

### 5.1 风险
- **循环依赖**：repository import service 可能引入循环。缓解：优先用独立纯函数包；实施第一步先验证依赖方向。
- **取整差异**：`creditAmount` 用 `+9_999)/10_000`，`tokenEstimateAmount` 用 `+9_999_999_999)/10_000_000_000`，两者乘数分母不同（10_000 vs 10_000_000_000）。抽共享时必须保留各自分母，不能统一。**这是最易错点，测试必须覆盖。**
- **`tokenUsageAmount` 的 video 特判**：`order.Capability == "video" && usage.OutputTokens <= 0` 返回 `ErrBillingUsageUnavailable`，这个校验在结算侧保留原位，不进 `tokenAmount`（它是结算语义不是算价语义）。

### 5.2 回滚
- 阶段 1 是纯重构，无表结构变更，回滚 = `git revert` 单次提交。
- 建议作为一个 commit 提交，便于回滚。

---

## 6. 交付清单

- [ ] 新增 `backend/internal/service/cost_calculator.go`（含 `PricingParams` / `CalculateCost` / `tokenAmount` / `safeTokenProduct`）；
- [ ] 新增 `backend/internal/service/cost_calculator_test.go`；
- [ ] 改造 `backend/internal/service/finance.go` 的 `newBillingOrder`（移除 switch，委托计算器）；
- [ ] 改造 `backend/internal/service/channel_models.go` 的 `supportsTokenBilling`（映射表）；
- [ ] 改造 `backend/internal/repository/finance.go` 的 `tokenUsageAmount`（调用共享 `tokenAmount`）；
- [ ] 删除 `finance.go` 的 `tokenEstimateAmount` / `safeTokenProduct`（被共享函数替代）；
- [ ] 删除 `repository/finance.go` 的 `safeTokenUsageProduct`（被共享函数替代）；
- [ ] 现有测试全部通过；
- [ ] 同步更新 `docs/content/docs/backend/` 计费相关文档（如有）；
- [ ] 写入 `pending-test.mdx`（按 AGENTS.md §10）。
