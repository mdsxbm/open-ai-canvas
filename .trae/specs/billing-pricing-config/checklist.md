# 验收清单：PricingConfigJSON 基础设施 + 离散档计费（阶段 2）

> 关联 spec：`.trae/specs/billing-pricing-config/spec.md`

## 后端数据模型
- [ ] `ChannelModel` 新增 `PricingConfigJSON`（gorm:"type:text"）+ `PricingVersion`（int64）+ `PricingConfig`（map[string]any, gorm:"-")
- [ ] DB 迁移：GORM AutoMigrate 自动加列，旧行新列为空字符串/0
- [ ] 旧三种 BillingMode 的模型 `PricingConfigJSON` 为空，行为不变

## 计费形状 per_video_bucket
- [ ] `billing.ModePerVideoBucket = "per_video_bucket"` 常量定义
- [ ] `PricingParams` 加 `Config map[string]any` 字段
- [ ] `calculateVideoBucket` 纯函数：buckets 非空、bucket key 命中、价格正整数
- [ ] 缺配置 / 缺 bucket / 档位不存在 / 价格非法 各自返回明确 error
- [ ] 不乘 multiplier（与 fixed_request 语义一致）
- [ ] `CalculateCost` 加 `case ModePerVideoBucket` 派发

## 后端校验与序列化
- [ ] `ChannelModelRequest` 加 `PricingConfig map[string]any` 字段
- [ ] `SaveAdminChannelModel` 校验 `per_video_bucket` 仅限 video capability
- [ ] `validatePricingConfig` 校验 buckets 非空、价格正整数
- [ ] `normalizePricingConfig` 序列化前规范化
- [ ] `PricingConfigJSON` 变更时 `PricingVersion++`（仿 CapabilityVersion）
- [ ] 旧三种 mode 时 `PricingConfigJSON=""` / `PricingVersion=0`

## newBillingOrder 改造
- [ ] switch 加 `case "per_video_bucket"`：校验 capability == "video"
- [ ] 从 payload 解析 bucket key（videoSeconds + vquality 拼 "5_720"）
- [ ] 组装 `PricingParams.Config` 传 buckets + bucket
- [ ] 解析失败返回明确 error，不静默 fallback

## 前端类型
- [ ] `ChannelModel.billingMode` 联合类型加 `"per_video_bucket"`
- [ ] `ChannelModel` 加 `pricingConfig?: VideoBucketPricingConfig` / `pricingVersion?: number`
- [ ] 新增 `VideoBucketPricingConfig = { buckets: Record<string, number> }` 类型
- [ ] `createAdminChannelModel` / `updateAdminChannelModel` 的 input 类型兼容（Omit 自动包含新可选字段）

## 前端 UI
- [ ] `FormValues` 加 `pricingConfig?: VideoBucketPricingConfig`
- [ ] Segmented options 加 `{ label: "视频离散档", value: "per_video_bucket", disabled: modelCapability !== "video" }`
- [ ] `billingMode === "per_video_bucket"` 时渲染 bucket 编辑器（4 档固定：5s/720p、5s/1080p、10s/720p、10s/1080p）
- [ ] `startEdit` 回填 `pricingConfig`
- [ ] `save` 组装 `pricingConfig` payload
- [ ] `billingSummary` 加 `per_video_bucket` 展示分支
- [ ] `handleFormValuesChange` 切换 capability 时重置 `per_video_bucket`（非 video 时）

## 范围控制
- [ ] 未加 `per_image_by_resolution`（留给阶段 3）
- [ ] 未改旧三种 BillingMode 计算路径
- [ ] 未改结算侧 `tokenUsageAmount`
- [ ] 未改 wallet/credits 状态机
- [ ] 未改即梦视频 5s/10s 硬编码校验
- [ ] 未改前端模型列表 UI（只改编辑 Drawer）

## 测试与验证
- [ ] `billing/cost_calculator_test.go` 加 per_video_bucket 测试（正常/缺配置/缺 bucket/档位不存在/价格非法）
- [ ] `service/channel_models_test.go` 加 per_video_bucket 校验测试
- [ ] 现有测试全部通过（回归）
- [ ] `web/` 跑 `bun run typecheck` 无报错
- [ ] 交付说明未运行 build / dev server

## 文档与流程
- [ ] `CHANGELOG.md` Unreleased 更新
- [ ] 单次 commit 提交
