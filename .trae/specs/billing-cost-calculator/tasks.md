# 任务分解：计费计算器解耦（阶段 1）

> 关联 spec：`.trae/specs/billing-cost-calculator/spec.md`
> 建议执行顺序：T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8

## T1 验证依赖方向，决定纯函数包位置
- 确认 repository import service 是否引入循环依赖
- 若循环：新建 `backend/internal/billing/` 纯函数包，`tokenAmount` / `safeTokenProduct` 放此包，service + repository 都 import
- 若不循环：放 `backend/internal/service/cost_calculator.go`
- **产出**：依赖方向结论 + 纯函数包最终路径决定

## T2 新增纯函数包 / 文件骨架
- 创建 `cost_calculator.go`（或 `internal/billing/calculator.go`）
- 定义 `PricingParams` 结构体
- 定义 `CalculateCost(params) (int64, error)` 签名，内部按 `BillingMode` 派发
- 实现三个私有函数：`calculateFixedRequest` / `calculatePerSecond` / `calculateToken`
- `calculateFixedRequest` / `calculatePerSecond` 复用 `creditAmount`
- 抽出共享 `tokenAmount` + `safeTokenProduct`，删除 `finance.go` 的 `safeTokenProduct`
- **产出**：计算器骨架可编译，但 `newBillingOrder` 尚未调用

## T3 新增计算器单元测试
- `cost_calculator_test.go`
- 三种 mode 各覆盖：正常值、零值、溢出、参数非法
- token 模式覆盖 cached=0（创建侧）和 cached>0（结算侧）
- **产出**：测试通过

## T4 改造 `newBillingOrder` 委托计算器
- [finance.go:557-622](file:///workspace/backend/internal/service/finance.go#L557-L622)
- 移除 `switch item.BillingMode` 算价段
- 抽出 `validateBillingMode` 做能力匹配校验
- 金额改由 `CalculateCost` 计算
- 删除 `tokenEstimateAmount`（被计算器替代）
- **产出**：`newBillingOrder` 不再含算价逻辑

## T5 改造 `supportsTokenBilling` 用映射表
- [channel_models.go:228-230](file:///workspace/backend/internal/service/channel_models.go#L228-L230)
- 新增 `tokenBillingProtocols` map
- `supportsTokenBilling` 改为查表
- **产出**：provider 协议名不出现在计费判断逻辑

## T6 改造结算侧 `tokenUsageAmount`
- [repository/finance.go:616-645](file:///workspace/backend/internal/repository/finance.go#L616-L645)
- 改为调用共享 `tokenAmount`
- 删除 `safeTokenUsageProduct`
- 保留 `order.Capability == "video" && usage.OutputTokens <= 0` 的结算语义校验原位
- **产出**：结算侧与创建侧共享同一 token 算价实现

## T7 运行现有测试回归
- `cd backend && go test ./internal/service/... ./internal/repository/...`
- 全部通过
- **产出**：行为等价性验证通过

## T8 文档与收尾
- 同步 `docs/content/docs/backend/` 计费文档（如存在）
- 写入 `pending-test.mdx`：说明本次重构未由用户确认
- 单次 commit
- 交付说明未运行验证
- **产出**：文档同步 + pending-test 更新
