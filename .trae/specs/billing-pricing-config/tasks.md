# 任务分解：PricingConfigJSON 基础设施 + 离散档计费（阶段 2）

> 关联 spec：`.trae/specs/billing-pricing-config/spec.md`
> 建议执行顺序：T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9

## T1 后端数据模型扩展
- `internal/model/models_channel.go`：`ChannelModel` 加 `PricingConfigJSON string`（gorm:"type:text"）+ `PricingVersion int64` + `PricingConfig map[string]any`（gorm:"-"，json:"pricingConfig,omitempty"）
- 仿 `CapabilityConfigJSON` / `CapabilityConfig` / `CapabilityVersion` 三件套
- **产出**：模型字段就位，GORM AutoMigrate 自动加列

## T2 计费形状 per_video_bucket 落地到 billing 包
- `internal/billing/cost_calculator.go`：加 `ModePerVideoBucket` 常量
- `PricingParams` 加 `Config map[string]any` 字段
- 实现 `calculateVideoBucket(config)`：buckets 非空、bucket key 命中、价格正整数
- 加 `toInt64` helper（处理 JSON 解析后的 `float64` / `int` / `json.Number`）
- `CalculateCost` 加 `case ModePerVideoBucket` 派发
- **产出**：计算器支持 per_video_bucket，纯函数可测

## T3 billing 包测试
- `internal/billing/cost_calculator_test.go` 加 case：
  - 正常档位命中（buckets 有 key，bucket 命中）
  - 缺配置（Config nil）
  - 缺 buckets（空 map）
  - 缺 bucket key（bucket="" ）
  - 档位不存在
  - 价格非法（0 / 负数 / 非数字）
- **产出**：测试通过

## T4 后端 ChannelModelRequest + SaveAdminChannelModel 校验
- `internal/service/channel_models.go`：`ChannelModelRequest` 加 `PricingConfig map[string]any`
- `SaveAdminChannelModel` 加 `per_video_bucket` 校验：仅 video capability
- 新增 `validatePricingConfig(billingMode, config)` 和 `normalizePricingConfig(billingMode, config)`
- 仿 `CapabilityConfig` 序列化路径：marshal → 对比 → `PricingVersion++` → 存 `PricingConfigJSON`
- 旧三种 mode 时清空 `PricingConfigJSON` / `PricingVersion`
- **产出**：管理员可保存 per_video_bucket 配置

## T5 后端 channel_models 测试
- `internal/service/channel_models_test.go` 加 case：
  - per_video_bucket 非 video 拒绝
  - per_video_bucket 缺 buckets 拒绝
  - per_video_bucket 价格非法拒绝
  - per_video_bucket 合法保存成功，PricingVersion 递增
- **产出**：校验路径测试通过

## T6 newBillingOrder 改造
- `internal/service/finance.go`：`switch item.BillingMode` 加 `case "per_video_bucket"`
- 校验 `capability == "video"`
- 从 payload 解析 bucket key：复用 `billingQuantity` 路径提取 videoSeconds + vquality，拼 "5_720"
- 组装 `PricingParams.Config` 传 buckets + bucket
- 解析失败返回明确 error
- **产出**：计费订单可按 per_video_bucket 创建

## T7 前端类型扩展
- `web/src/services/api/wallet.ts`：
  - `ChannelModel.billingMode` 加 `"per_video_bucket"`
  - 加 `pricingConfig?: VideoBucketPricingConfig` / `pricingVersion?: number`
  - 新增 `VideoBucketPricingConfig = { buckets: Record<string, number> }`
- **产出**：前端类型就位，Omit input 自动包含新可选字段

## T8 前端模型编辑 UI 扩展
- `web/src/pages/admin/components/channel-model-manager.tsx`：
  - `FormValues` 加 `pricingConfig?: VideoBucketPricingConfig`
  - Segmented 加 `{ label: "视频离散档", value: "per_video_bucket", disabled: modelCapability !== "video" }`
  - `billingMode === "per_video_bucket"` 渲染 4 档固定编辑器（5_720 / 5_1080 / 10_720 / 10_1080）
  - `startEdit` 回填 pricingConfig
  - `save` 组装 pricingConfig payload（microcredits）
  - `billingSummary` 加 per_video_bucket 展示
  - `handleFormValuesChange` 切换 capability 时重置 billingMode（非 video 时不能留 per_video_bucket）
- **产出**：管理员可在 UI 配置 per_video_bucket

## T9 回归 + 文档 + commit
- `cd backend && go test ./internal/billing/... ./internal/service/... ./internal/repository/...`
- `cd web && bun run typecheck`
- `CHANGELOG.md` Unreleased 更新
- 单次 commit
- 交付说明未运行 build / dev server
- **产出**：全部通过 + 文档同步 + commit
