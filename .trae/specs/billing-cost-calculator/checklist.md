# 验收清单：计费计算器解耦（阶段 1）

> 关联 spec：`.trae/specs/billing-cost-calculator/spec.md`

## 行为等价性（必须 100%）
- [ ] `fixed_request` 模式算价金额与改造前字节级一致
- [ ] `per_second` 模式算价金额与改造前字节级一致
- [ ] `token` 文本模式创建侧预估金额与改造前一致
- [ ] `token` 视频模式创建侧预估金额与改造前一致（`estimateArkVideoTokens` 不动）
- [ ] `token` 结算侧真实用量重算金额与改造前一致
- [ ] `supportsTokenBilling` 返回值与改造前一致（映射表内容等价硬编码）
- [ ] 取整规则保留各自分母：`creditAmount` 用 `+9_999)/10_000`，token 用 `+9_999_999_999)/10_000_000_000`

## 代码质量
- [ ] `newBillingOrder` 不再含 `switch item.BillingMode` 算价逻辑
- [ ] `cost_calculator.go` 是纯函数，不访问 repo / DB
- [ ] 共享 `tokenAmount` 同时被创建侧和结算侧复用
- [ ] `safeTokenProduct` 只剩一份（不再有 `safeTokenProduct` + `safeTokenUsageProduct` 两份）
- [ ] 无循环依赖（repository 调用计算器函数的路径已验证）
- [ ] provider 协议名（`火山方舟视频`）不出现在计费计算路径，只在映射表

## 范围控制
- [ ] 未新增 `BillingMode` 值
- [ ] 未改 `ChannelModel` / `BillingOrder` / `ApiCallLog` 表结构
- [ ] 未改前端 JSON 合同（字段名、含义）
- [ ] 未改 `estimateArkVideoTokens` / `arkVideoOutputPixels` 预估逻辑
- [ ] 未改 `CreditPolicy` / `MultiplierBPS` 逻辑
- [ ] 未改人工核对 / reserve / settle / refund 状态机

## 测试
- [ ] 新增 `cost_calculator_test.go` 覆盖三种 mode 正常值
- [ ] 覆盖零值、溢出、参数非法
- [ ] 覆盖 cached > 0 的结算路径
- [ ] [admin_channel_test.go](file:///workspace/backend/internal/service/admin_channel_test.go) 通过
- [ ] [task_security_test.go](file:///workspace/backend/internal/service/task_security_test.go) 通过
- [ ] [desktop_local_channel_flow_test.go](file:///workspace/backend/internal/service/desktop_local_channel_flow_test.go) 通过
- [ ] [repository/finance_token_test.go](file:///workspace/backend/internal/repository/finance_token_test.go) 通过

## 文档与流程
- [ ] 同步 `docs/content/docs/backend/` 计费相关文档（如存在）
- [ ] 写入 `pending-test.mdx`
- [ ] 单次 commit 提交，便于回滚
- [ ] 交付说明明确未运行验证（按 AGENTS.md §9）
