# 规格文档：PricingConfigJSON 基础设施 + 离散档计费形状（阶段 2，修订版）

> 产物所属 Spec 目录：`.trae/specs/billing-pricing-config/`
> 自然语言：中文
> 关联仓库：影策 AI 影视创作工作台（`backend/` Go + `web/` React 19）
> 阶段定位：多模型 + 计费重构的第 2 阶段，建立 PricingConfigJSON 基础设施，引入离散档计费形状，支持管理员自定义档位和字段可配置解析。
> 前置：阶段 1 已完成（commit 99a0042），计算器已解耦到 `internal/billing` 纯函数包。

---

## 0. 背景摘要

### 0.1 问题
阶段 1 把计费计算解耦到了 `billing.CalculateCost`，但 `PricingParams` 仍是平铺字段（`UnitPrice`/`InputTokens`/`OutputTokens`/`CachedTokens` + 三种 `BillingMode`），无法表达细粒度定价形状。

**视频模型时长差异巨大**（2026-08 调研，已核对官方/社区一手资料）：
| 模型 | 时长 | 分辨率 | 计费形状 |
|---|---|---|---|
| MiniMax H3（2026-07-31 发布） | 4–15s 连续整数 | 原生 768P（短边 768）+ H3-Regenerate-2K 升 2K | 官方 $0.08/s@768P、$0.13/s@2K，**按秒线性** → `per_second` |
| Seedance 1.5 pro | 4–12s | 720p | `per_second` |
| Seedance 2.0 | 4–15s | 720p（后升 4K） | `per_second` |
| Seedance 2.5 | 4–30s 连续 | 原生 480p/720p/1080p/4K | **按秒线性** → `per_second` |
| Wan3 | 30s 连续 | — | **按秒线性** → `per_second` |
| 即梦视频 | 5s / 10s 离散 | 720p/1080p | 5s 与 10s 单价不同，**非时长线性** → `per_video_bucket` |

时长是连续区间或多离散值，**不是固定 4 档**。当前 `per_second`（连续时长×单价）对 MiniMax H3 / Seedance 2.5 / Wan3 的连续时长区间全可用，但对即梦那种「5s/10s 离散定价」无法表达——5s 和 10s 单价不同，不能简单乘时长。离散档计费形状是真实痛点。
`per_second` 与 `per_video_bucket` 互补：连续时长模型走 `per_second`（按秒线性），离散定价模型走 `per_video_bucket`（按 bucket key 查价）。

参考 ArcReel 的「定价形状是数据，计算策略是逻辑」模式：每种形状一个 `kind` 标签 + `rates` dict 存形状特定参数，计算器按 `kind` 派发。阶段 2 引入这个模式。

### 0.2 目标
**建立 PricingConfigJSON 基础设施，引入 `per_video_bucket`（视频离散档）形状，支持管理员自定义档位和字段可配置解析，验证基础设施可用并保留扩展点。**

具体交付：
1. `ChannelModel` 加 `PricingConfigJSON` 字段（仿 `CapabilityConfigJSON` 模式）+ 表迁移；
2. `billing.CalculateCost` 扩展支持 `per_video_bucket` 形状，参数从 `PricingParams.Config` 读取；
3. `ChannelModelRequest` 加 `PricingConfig` 字段，`SaveAdminChannelModel` 加校验和序列化；
4. `newBillingOrder` 把 `item.PricingConfig` 传给计算器，并按 `bucketKeyFields` 配置从请求 payload 解析 bucket key；
5. 前端 `ChannelModel` 类型加 `pricingConfig`，模型编辑 UI 加 `per_video_bucket` 选项和**动态档位编辑器**（`Form.List` 增删）+ `bucketKeyFields` 配置；
6. 旧三种 `BillingMode` + 4 个平铺字段保留作 fallback，**已有模型配置零迁移**。

### 0.3 非目标
- **不加 `per_image_by_resolution`**：留给阶段 3，本阶段只验证一种新形状；
- **不改旧三种 BillingMode 行为**：`fixed_request`/`per_second`/`token` 计算路径不变，旧模型配置不迁移；
- **不改结算侧 `tokenUsageAmount`**：离散档是预授权即终值，无结算重算（与 `fixed_request` 同语义）；
- **不改 wallet/credits 状态机**：reserve/settle/refund 流程不变，`per_video_bucket` 走与 `fixed_request` 相同的 reserve→settle 路径；
- **不改即梦视频 5s/10s 校验**：[finance.go:569-571](file:///workspace/backend/internal/service/finance.go#L569-L571) 的硬编码校验保留，`per_video_bucket` 是新增选项不是替换；
- **不改前端模型列表 UI**：只改编辑 Drawer 内的计费表单；
- **不做多 API Key 切换和项目级供应商覆盖**：ArcReel 这套供应商管理能力与计费正交，单独立 spec（见 §7）。

---

## 1. 现状代码地图

### 1.1 后端数据模型
- [models_channel.go:27-48](file:///workspace/backend/internal/model/models_channel.go#L27-L48) `ChannelModel`：4 个平铺价格字段 + `BillingMode` + `CapabilityConfigJSON`（模式参考）。
- [models_channel.go:42-44](file:///workspace/backend/internal/model/models_channel.go#L42-L44) `CapabilityConfigJSON` + `CapabilityConfig` + `CapabilityVersion`：DB 存 JSON string，内存 map，version 跟踪变更。

### 1.2 后端计费
- [billing/cost_calculator.go](file:///workspace/backend/internal/billing/cost_calculator.go) `CalculateCost`：按 `BillingMode` 派发，`PricingParams` 平铺字段。
- [service/finance.go:605-617](file:///workspace/backend/internal/service/finance.go#L605-L617) `newBillingOrder`：组装 `PricingParams` 传给计算器。
- [service/finance.go:569-571](file:///workspace/backend/internal/service/finance.go#L569-L571) 即梦视频 5s/10s 硬编码校验。
- [service/finance.go:762-790](file:///workspace/backend/internal/service/finance.go#L762-L790) `billingQuantity`：从 payload 解析 videoSeconds（已有逻辑，可复用）。

### 1.3 后端校验
- [service/channel_models.go:128-226](file:///workspace/backend/internal/service/channel_models.go#L128-L226) `SaveAdminChannelModel`：`BillingMode` 合法性 + 价格非负 + token 至少一项价格。
- [service/channel_models.go:16-29](file:///workspace/backend/internal/service/channel_models.go#L16-L29) `ChannelModelRequest`：DTO，含 4 个平铺价格 + `CapabilityConfig`。

### 1.4 前端
- [services/api/wallet.ts:49-61](file:///workspace/web/src/services/api/wallet.ts#L49-L61) `ChannelModel` 类型，`Omit` 作 API input。
- [pages/admin/components/channel-model-manager.tsx:263-291](file:///workspace/web/src/pages/admin/components/channel-model-manager.tsx#L263-L291) 计费表单：Segmented 切三种 mode + token 下区分 video/text。
- [lib/model-protocols.ts:91-93](file:///workspace/web/src/lib/model-protocols.ts#L91-L93) `modelProtocolSupportsTokenBilling`：与后端镜像的硬编码。

---

## 2. 目标结构

### 2.1 后端数据模型扩展

[models_channel.go](file:///workspace/backend/internal/model/models_channel.go) `ChannelModel` 加三个字段：

```go
type ChannelModel struct {
    // ... 现有字段不变
    PricingConfigJSON string         `json:"-" gorm:"type:text"`
    PricingVersion    int64          `json:"pricingVersion"`
    PricingConfig     map[string]any `json:"pricingConfig,omitempty" gorm:"-"`
    // ...
}
```

- `PricingConfigJSON`：DB 存储，仿 `CapabilityConfigJSON`。
- `PricingConfig`：内存字段 + JSON 序列化传输，`gorm:"-"`。
- `PricingVersion`：跟踪变更，仿 `CapabilityVersion`。

旧 4 个平铺字段（`UnitPriceMicrocredits` 等）+ `BillingMode` 保留，旧配置零迁移。

### 2.2 计费形状定义

新增 `per_video_bucket` 形状（[billing/cost_calculator.go](file:///workspace/backend/internal/billing/cost_calculator.go)）：

```go
const (
    // 现有三种不变
    ModePerVideoBucket = "per_video_bucket" // 视频离散档：按 bucket key 查价
)

// PricingParams 加 Config 字段，形状特定参数放这里。
// per_video_bucket 的 Config 形如：
//   {
//     "bucketKeyFields": ["duration", "resolution"],  // 从 payload 提取的字段名
//     "buckets": { "5_720p": 100000, "10_1080p": 200000, "15_2k": 300000 }
//   }
// bucketKeyFields 定义 key 拼接顺序；buckets 是 key→microcredits 映射。
// 运行时由 newBillingOrder 按 bucketKeyFields 从 payload 提取值，用 "_" 拼成 key，
// 再从 buckets 查价。管理员可自由定义字段名和 key 格式，适配任意模型。
type PricingParams struct {
    // ... 现有平铺字段不变
    Config map[string]any // 形状特定参数；旧三种 mode 不用此字段
}
```

`CalculateCost` 加 case：

```go
case ModePerVideoBucket:
    return calculateVideoBucket(params.Config)
```

```go
// calculateVideoBucket 按 bucket key 查价。
// bucket key 由调用方（newBillingOrder）按 bucketKeyFields 从 payload 提取拼接后，
// 放在 Config["bucket"] 传入。本函数只负责查价，不负责解析 payload。
// 找不到档位返回 error，不静默 fallback 到 fixed_request。
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
    // 离散档是预授权即终值，不乘 multiplier（与 fixed_request 语义一致，
    // multiplier 已体现在管理员配置的 bucket 价格里）。
    return priceMicro, nil
}
```

### 2.3 ChannelModelRequest 扩展

[service/channel_models.go](file:///workspace/backend/internal/service/channel_models.go) `ChannelModelRequest` 加字段：

```go
type ChannelModelRequest struct {
    // ... 现有字段不变
    PricingConfig map[string]any `json:"pricingConfig,omitempty"`
}
```

`SaveAdminChannelModel` 加校验和序列化（仿 `CapabilityConfig` 处理）：

```go
// 在 BillingMode 合法性校验后加：
if billingMode == "per_video_bucket" {
    if capability != "video" {
        return nil, BadAuthRequest("视频离散档计费仅适用于视频模型")
    }
    if err := validatePricingConfig(billingMode, req.PricingConfig); err != nil {
        return nil, err
    }
}

// 在组装 item 时加（仿 CapabilityConfig 序列化）：
if billingMode == "per_video_bucket" {
    normalized, err := normalizePricingConfig(billingMode, req.PricingConfig)
    if err != nil {
        return nil, err
    }
    encoded, err := json.Marshal(normalized)
    if err != nil {
        return nil, err
    }
    if item.PricingConfigJSON != string(encoded) {
        item.PricingVersion++
    }
    item.PricingConfigJSON = string(encoded)
} else {
    item.PricingConfigJSON = ""
    item.PricingVersion = 0
}
```

`validatePricingConfig` / `normalizePricingConfig` 放 `service/channel_models.go`：

```go
// validatePricingConfig 校验 per_video_bucket 配置：
//   - bucketKeyFields 非空数组，元素为非空字符串
//   - buckets 非空 map，key 非空，值为正整数（microcredits）
func validatePricingConfig(billingMode string, config map[string]any) error {
    if billingMode != "per_video_bucket" {
        return nil
    }
    if config == nil {
        return BadAuthRequest("视频离散档计费缺少配置")
    }
    fields, _ := config["bucketKeyFields"].([]any)
    if len(fields) == 0 {
        return BadAuthRequest("视频离散档计费需配置档位字段")
    }
    for _, f := range fields {
        name, ok := f.(string)
        if !ok || strings.TrimSpace(name) == "" {
            return BadAuthRequest("视频离散档计费档位字段名无效")
        }
    }
    buckets, _ := config["buckets"].(map[string]any)
    if len(buckets) == 0 {
        return BadAuthRequest("视频离散档计费至少配置一个档位价格")
    }
    for key, value := range buckets {
        if strings.TrimSpace(key) == "" {
            return BadAuthRequest("视频离散档计费档位 key 不能为空")
        }
        price, ok := toInt64(value)
        if !ok || price <= 0 {
            return BadAuthRequest(fmt.Sprintf("视频离散档计费档位 %q 价格无效", key))
        }
    }
    return nil
}
```

### 2.4 newBillingOrder 改造

[service/finance.go](file:///workspace/backend/internal/service/finance.go) `newBillingOrder`：

1. `switch item.BillingMode` 加 `case "per_video_bucket"`：校验 `capability == "video"`，按 `bucketKeyFields` 从 payload 解析 bucket key。
2. 组装 `PricingParams` 时传 `Config`：

```go
case "per_video_bucket":
    if capability != "video" || item.Capability != "video" {
        return nil, BadAuthRequest("视频离散档计费仅适用于视频生成")
    }
    bucketKey, err := resolveVideoBucketKey(item.PricingConfig, payload)
    if err != nil {
        return nil, err
    }
    // ...后续组装 Config
```

```go
// resolveVideoBucketKey 按 bucketKeyFields 从 payload 提取值，用 "_" 拼成 bucket key。
// 字段查找顺序：config.payload.config.<field> → config.<field> → 顶层 <field>，
// 兼容不同 provider 的 payload 嵌套结构。
func resolveVideoBucketKey(pricingConfig map[string]any, payload map[string]any) (string, error) {
    fields, _ := pricingConfig["bucketKeyFields"].([]any)
    if len(fields) == 0 {
        return "", errors.New("视频离散档计费未配置档位字段")
    }
    values := make([]string, 0, len(fields))
    for _, f := range fields {
        name, _ := f.(string)
        value := extractPayloadField(payload, name)
        if value == "" {
            return "", fmt.Errorf("视频离散档计费无法从请求中提取档位字段 %q", name)
        }
        values = append(values, value)
    }
    return strings.Join(values, "_"), nil
}

// extractPayloadField 从 payload 嵌套结构提取字段值。
// 查找顺序：config.payload.config.<field> → config.<field> → 顶层 <field>
// 兼容火山方舟（config.videoSeconds/vquality）和即梦（顶层 duration）等不同结构。
func extractPayloadField(payload map[string]any, field string) string {
    // config.payload.config.<field>
    if config, ok := payload["config"].(map[string]any); ok {
        if inner, ok := config["config"].(map[string]any); ok {
            if v, ok := inner[field]; ok {
                return fmt.Sprintf("%v", v)
            }
        }
        // config.<field>
        if v, ok := config[field]; ok {
            return fmt.Sprintf("%v", v)
        }
    }
    // 顶层 <field>
    if v, ok := payload[field]; ok {
        return fmt.Sprintf("%v", v)
    }
    return ""
}
```

组装 `PricingParams`：

```go
amount, err := billing.CalculateCost(billing.PricingParams{
    BillingMode:   item.BillingMode,
    // ... 现有字段
    Config: map[string]any{
        "buckets": item.PricingConfig["buckets"],
        "bucket":  bucketKey,
    },
})
```

### 2.5 前端类型扩展

[services/api/wallet.ts](file:///workspace/web/src/services/api/wallet.ts) `ChannelModel` 类型：

```typescript
export type ChannelModel = {
    // ... 现有字段不变
    billingMode: "fixed_request" | "per_second" | "token" | "per_video_bucket";
    pricingConfig?: VideoBucketPricingConfig;
    pricingVersion?: number;
    // ...
};

export type VideoBucketPricingConfig = {
    bucketKeyFields: string[];            // 从 payload 提取的字段名，如 ["duration","resolution"]
    buckets: Record<string, number>;     // 档位 key → microcredits，如 { "5_720p": 100000 }
};
```

### 2.6 前端 UI 扩展

[pages/admin/components/channel-model-manager.tsx](file:///workspace/web/src/pages/admin/components/channel-model-manager.tsx)：

1. `FormValues` 加 `pricingConfig?: VideoBucketPricingConfig`。
2. `Segmented` options 加 `{ label: "视频离散档", value: "per_video_bucket", disabled: modelCapability !== "video" }`。
3. `billingMode === "per_video_bucket"` 时渲染：
   - **bucketKeyFields 编辑器**：`Select` mode="tags" 让管理员输入字段名（如 `duration`、`resolution`、`vquality`、`size`），2–3 个字段。
   - **buckets 动态编辑器**：`Form.List` 增删档位，每行 = key 输入框（自由文本，如 `5_720p`）+ 积分价格 `InputNumber`。
4. `startEdit` 回填 `pricingConfig`。
5. `save` 组装 `pricingConfig` payload。
6. `billingSummary` 加 `per_video_bucket` 展示分支（列出档位数 + 首档价格）。
7. `handleFormValuesChange` 切换 capability 离开 video 时重置 `per_video_bucket` → `fixed_request`。

---

## 3. 兼容性与迁移

| 场景 | 处理 |
|---|---|
| 旧模型（fixed_request/per_second/token） | `PricingConfigJSON` 为空，`PricingVersion` 为 0，行为不变 |
| 新模型（per_video_bucket） | 旧 4 个平铺字段为 0，`PricingConfigJSON` 存 buckets + bucketKeyFields |
| DB 迁移 | GORM AutoMigrate 自动加列，旧行新列为空字符串/0 |
| 前端旧数据 | `pricingConfig` undefined，UI 显示旧三种 mode |
| 前端新数据 | `billingMode` 为 `per_video_bucket`，UI 显示动态档位编辑器 |

---

## 4. 验证方式

### 4.1 后端单元测试
- `billing/cost_calculator_test.go` 加 `per_video_bucket` case：正常档位、缺配置、缺 bucket、档位不存在、价格非法。
- `service/channel_models_test.go` 加 `SaveAdminChannelModel` 的 `per_video_bucket` 校验路径（缺 fields、缺 buckets、价格非法）。
- `service/finance_test.go`（新建或现有）加 `resolveVideoBucketKey` 测试：正常提取、字段不存在、嵌套结构。
- 现有测试全部通过（回归）。

### 4.2 前端
- `web/` 跑 `bun run typecheck` 确认类型无报错。
- 不启动 dev server（按 AGENTS.md §9，用户未要求浏览器预览）。

### 4.3 不运行的验证
- 不跑 build、不跑 lint、不启动 dev server；
- 交付时明确说明未运行验证，由用户决定何时跑。

---

## 5. 风险与回滚

### 5.1 风险
- **表迁移**：加 3 列，SQLite/PostgreSQL 都支持 ALTER TABLE ADD COLUMN，旧行新列为默认值。风险低。
- **前端合同**：`ChannelModel` 类型加可选字段，`Omit` 作 input 时新字段可选，旧前端发旧 payload 后端 `pricingConfig` 为 nil，走旧路径。风险低。
- **bucket key 解析失败**：若 payload 字段名与 `bucketKeyFields` 配置不匹配会解析失败。缓解：解析失败返回明确 error，提示管理员检查 `bucketKeyFields` 配置；前端在档位编辑器旁展示字段名提示。
- **multiplier 处理**：`per_video_bucket` 不乘 multiplier（与 `fixed_request` 语义一致，bucket 价格已是最终价）。若管理员想用 multiplier，在配置 bucket 价格时已体现。
- **payload 字段名差异**：不同 provider 的 payload 结构不同（火山方舟嵌套 `config.config`，即梦顶层）。`extractPayloadField` 按三级查找兼容，但极端情况可能仍需管理员调整 `bucketKeyFields`。

### 5.2 回滚
- 表结构变更可回滚（DROP COLUMN，但 SQLite 不支持，需重建表）。
- 代码回滚 = `git revert` 单次 commit。
- 建议作为一个 commit 提交，便于回滚。

---

## 6. 交付清单

### 后端
- [ ] `internal/model/models_channel.go`：`ChannelModel` 加 `PricingConfigJSON`/`PricingVersion`/`PricingConfig`。
- [ ] `internal/billing/cost_calculator.go`：加 `ModePerVideoBucket` + `PricingParams.Config` + `calculateVideoBucket` + `toInt64` helper。
- [ ] `internal/billing/cost_calculator_test.go`：加 `per_video_bucket` 测试。
- [ ] `internal/service/channel_models.go`：`ChannelModelRequest` 加 `PricingConfig`；`SaveAdminChannelModel` 加校验 + 序列化；新增 `validatePricingConfig`/`normalizePricingConfig`。
- [ ] `internal/service/channel_models_test.go`：加 `per_video_bucket` 校验测试。
- [ ] `internal/service/finance.go`：`newBillingOrder` 加 `per_video_bucket` case + `resolveVideoBucketKey` + `extractPayloadField`。
- [ ] `internal/service/finance_test.go`：加 `resolveVideoBucketKey` 测试。

### 前端
- [ ] `services/api/wallet.ts`：`ChannelModel` 加 `pricingConfig`/`pricingVersion`；新增 `VideoBucketPricingConfig` 类型。
- [ ] `pages/admin/components/channel-model-manager.tsx`：`FormValues` 加 `pricingConfig`；Segmented 加 `per_video_bucket`；bucketKeyFields 编辑器（Select tags）；buckets 动态编辑器（Form.List）；`save` 组装；`billingSummary` 分支；`handleFormValuesChange` 重置。

### 文档与流程
- [ ] `CHANGELOG.md` Unreleased 更新。
- [ ] 单次 commit 提交。
- [ ] 交付说明未运行验证。

---

## 7. 后续独立 spec（不在本阶段范围）

ArcReel 的「官方 apikey 配置」本质是「自定义供应商 + 多 API Key 切换 + 项目级供应商覆盖」。影策现状：

- **自定义供应商**：已覆盖。`ModelChannel` 有 `Name`/`BaseURL`/`APIKey`/`SecretKey`/`APIFormat`/`ModelsJSON`/`HeadersJSON`，用户级渠道（`Scope`）支持个人配置官方 API Key + Base URL，管理员渠道支持平台配置。
- **多 API Key 切换**：未覆盖。同一供应商只能配一个 API Key，无法切换激活。
- **项目级供应商覆盖**：未覆盖。渠道是全局的，无法按项目指定不同供应商。

这三点与计费形状正交，是渠道管理能力。建议单独立 spec `channel-multi-key-and-project-scope`，不在阶段 2 混做。
