# 实施任务队列：幕山 Moshine 品牌重塑 + 闭源商用化一期

> 归属规格：`.trae/specs/mosliy-brand-relaunch/spec.md`
> 本文档中每个任务的"验收覆盖"列出映射到 spec.md 的 AC-ID；每个任务的 TR（Task-local Test Requirement）在任务内部单独列出，类型严格为 `rule` 或 `rubric`。
> 任务优先级：`high`（P0 上线必需）/ `medium`（P1 首月完善）/ `low`（P2 后续打磨）
> **一期范围声明**：全部 17 个任务均在一期交付，无任何任务延期或取消。下列原"Cancelled"清单中提到的草稿草图锁定、360° 导演世界、资产 Prompt 中间件等垂直硬核能力仍属 Phase-2，不纳入一期 17 任务（不冲突——它们是"未来规划"而非"一期任务"）。

---

## 总体依赖图

```
Task 01 幕山品牌 Token & Logo 系统 ─┐
Task 02 法律文件 & 页脚四列布局 ───┤
Task 03 顶栏四矩阵导航重组 ────────┤
                                   ├─→ Task 06 全站用户侧品牌文案替换 & 合规勾选
                                   │
Task 04 全站 Head & SEO 统一 ──────┘
        │
        └─→ Task 05 LICENSE.brand & 原始 LICENSE 保留检查
                                   ┌── Task 07 幕山投拍 · 向导式创作入口
                                   │
Task 08 幕山首映 · Showcase ───────┤  Task 09 幕山攀登计划 · 邀请码系统（UI+模型+空接口）
Task 10 幕山攀登计划 · 活动/赛事 ──┤  Task 11 底层原子能力矩阵页
Task 12 幕山投拍 · 真人转绘子流程 ─┤  Task 13 主角模式 UI & 健康度徽章
                                   │  Task 14 导出菜单 & Studio 权益锁定
Task 15 公开定价 Pricing 页 ───────┤  Task 16 我的钱包 · 积分透明 & 模拟支付
                                   │
Task 17 管理后台 · 内容审核骨架（独立可并行）
```

**注意**：01–06 是品牌底层与合规（P0 必须先完成再做其余）；07–16 是产品功能（P0/P1 可与 17 并行）。

---

## Task 01：幕山品牌 Token & Logo 系统（CSS Semantic 层 + Wordmark + Mark 组件）

- **优先级**：high
- **负责人**：Implement
- **文件清单（修改/新增）**：
  - 修改：`web/src/styles/globals.css`（Semantic 区块追加 5 个新 token：`--brand` / `--brand-contrast` / `--brand-soft` / `--brand-glow` / `--accent`；**不新增 `--brand-gradient`**）
  - 修改：`web/src/lib/app-theme.ts`（AntD ConfigProvider 的 `colorPrimary` / `colorInfo` 绑定到 `--brand`，配色严格使用 neutral/zinc 灰阶 + amber 250 极淡强调色）
  - 新增：`web/src/components/brand/MoshineLogo.tsx`（Wordmark「幕山」+ Mark 二合一组件，props: `variant: 'wordmark' | 'mark' | 'both'`；`size: 'sm' | 'md' | 'lg'`；**纯黑/纯白单色，无渐变填充**）
- **验收覆盖**：AC-BR-04, AC-BR-05, AC-EN-04
- **TR**：
  - TR-01-01（rule）：`grep "\-\-brand\b\|\-\-brand-contrast\|\-\-brand-soft\|\-\-brand-glow\|\-\-accent\b" web/src/styles/globals.css` 返回 5 个定义且值全部包含 `var(--neutral-` 或 `var(--zinc-` 或 `var(--amber-`，没有字面 okLCH/hex/rgb；**禁止出现 `--brand-gradient` 变量**
  - TR-01-02（rule）：MoshineLogo 的 `'both'` variant 渲染后 DOM 中 wordmark 文本为「幕山」中文主字标，computed style `backgroundImage` 不包含 `linear-gradient`（验证纯色非渐变）
  - TR-01-03（rubric）：Logo 在 `lg/md/sm` 三档尺寸下 + dark/light 两种主题下无截断、黑白对比足够、Mark 内部「幕布齿孔 + 三竖山峰」负形结构可见（0–2，阈值 ≥1）

---

## Task 02：法律文件路由 + Footer 重排（4 条法律页 + 四列 Footer）

- **优先级**：high
- **文件清单**：
  - 新增：`web/src/pages/legal/user-agreement.tsx`、`privacy.tsx`、`dmca.tsx`、`disclaimer.tsx`（四个独立页面组件，骨架内容不少于 5 章）
  - 修改：`web/src/router.tsx`（新增 4 条 `/legal/*` 路由，公开可访问，不包 UserLayout）
  - 修改：`web/src/components/layout/app-footer.tsx`（不存在则新建，对应 app-top-nav 位置）→ 四列布局（产品/资源/社区/品牌）
  - 修改：`UserLayout` / 公开页的 Layout（如果有）把 Footer 挂到底部所有页面
  - 新增（后端占位）：`backend/internal/handler/legal.go`（可选，路由 `GET /api/legal/:doc` 返回 JSON 结构；一期直接前端渲染静态也行，接口占位即可）
- **验收覆盖**：AC-LG-01, AC-LG-03
- **TR**：
  - TR-02-01（rule）：`/legal/user-agreement` 等 4 条路由访问无 404、无权限拦截；页面字数统计每个 ≥ 800 中文字
  - TR-02-02（rule）：Footer DOM 中能找到字符串「基于 MIT 开源的影策 open-ai-canvas 二次改造」
  - TR-02-03（rule）：Footer 社区列存在 4 个二维码（4 个 `<svg>` 或 4 个 `<img>` 占位元素 + 对应标签文本：微信公众号「幕山 Moshine」/ 视频号「幕山创作台」/ 飞书话题群「幕山创作者官方群」/ 邮箱 hello@mosliy.com）

---

## Task 03：顶栏导航 IA 重组织（幕山工作坊 / 幕山投拍 / 幕山首映 / 幕山攀登计划 四矩阵）

- **优先级**：high
- **文件清单**：
  - 修改：`web/src/components/layout/app-top-nav.tsx`（主顶栏品牌重写）
  - 修改：`web/src/components/layout/workspace-top-bar.tsx`（如果是工作区顶栏，追加四个产品矩阵跳转入口下拉）
  - 修改：`web/src/router.tsx`（调整路由 landing：登录后默认 `/flow`；`/create` 重定向到 `/studio/projects`）
  - 新增：`web/src/components/layout/studio-nav.tsx`（幕山工作坊内部分组侧边栏：我的项目 / 我的画布 / 制作任务）
- **验收覆盖**：AC-BR-03
- **TR**：
  - TR-03-01（rule）：登录后主界面顶栏 DOM 中顺序出现四个字符串「幕山工作坊」/「幕山投拍」/「幕山首映」/「幕山攀登计划」（全中文，不出现 Studio/Flow/Stage/Creator 英文 Tab 名）
  - TR-03-02（rule）：点击「幕山投拍」跳 `/flow`，「幕山首映」跳 `/stage`，「幕山攀登计划」的「邀请好友」子项跳 `/creator/invite`，「幕山工作坊」的「我的项目」跳 `/studio/projects`
  - TR-03-03（rule）：`/create` 访问 → HTTP 302 到 `/studio/projects`（或前端 Redirect）

---

## Task 04：全站 Head 统一（title / meta / favicon / OG）

- **优先级**：high
- **文件清单**：
  - 修改：`web/index.html`（重写 `<title>`/`<meta description>`/`<meta og:*>`/favicon → 内联 SVG）
  - 新增：`web/src/components/brand/PageHead.tsx`（每个页面入口调用的封装组件，接收 `title` props，统一生成 `<Helmet>` 或 React 19 的 `<title>` 元素，拼接「 · 幕山 Moshine — 每一帧，都值得立一座山。」）
  - 修改：主要入口页面（home/create/canvas/projects/assets/settings/wallet/admin-shell）替换旧 title 设置 → 调用 PageHead
- **验收覆盖**：AC-BR-02
- **TR**：
  - TR-04-01（rule）：`curl http://local/` 获取 HTML 后 `<title>` 内容以「· 幕山 Moshine — 每一帧，都值得立一座山。」结尾
  - TR-04-02（rule）：`<meta name="description">` 内容包含「mosliy.com」
  - TR-04-03（rule）：旧 favicon 引用路径 `<link rel="icon" href="/canvas-logo.*"`（如果有）被替换；不存在任何指向旧品牌 logo 的路径

---

## Task 05：LICENSE 合规 + 商业品牌声明文件

- **优先级**：high
- **文件清单**：
  - 新增：`/workspace/LICENSE.brand`（1-2 行说明：幕山 Moshine 商业品牌部分版权为部署方所有；底层代码基于 MIT 授权的「影策 open-ai-canvas」二次改造；原始 MIT LICENSE 继续有效）
  - 检查：`/workspace/LICENSE`（确保原始 MIT 文件**字节级未改动**；如因 fork 已经带有作者版权声明，保留原样）
- **验收覆盖**：AC-EN-01
- **TR**：
  - TR-05-01（rule）：文件 LICENSE.brand 存在且包含「影策 open-ai-canvas」字符串
  - TR-05-02（rule）：LICENSE 文件首行仍为原始作者版权声明（任何行不得包含「删除」、「Moshine 替换原作者」等违规文字）

---

## Task 06：全站用户侧品牌文案替换 + 合规勾选框 + 空态电影感化

- **优先级**：high
- **文件清单**（根据 grep 结果逐文件修改；初步命中见 spec §5.1 列表）：
  - 搜索并替换前端页面可见文案：所有出现「影策」「Canvas Workbench」「open-ai-canvas 工作台」「TraeCanvas」的**渲染层**（不替换 JS 变量名/内部函数名/注释）
  - 修改：`web/src/pages/auth/register.tsx`（底部加入 ☑ 三链接协议勾选框 + 按钮禁用逻辑）
  - 修改：空态组件如 `EmptyProject` / `EmptyCanvas` / `EmptyAsset` / `EmptyTask`（文案替换为电影感比喻：「剧本还未落笔，先从一个创意开始吧 🎬」/「山脚已就位，向上开拍吧」等）
- **验收覆盖**：AC-BR-01, AC-LG-02, AC-EN-03
- **TR**：
  - TR-06-01（rule）：登录/注册/投拍/首映/攀登计划/工作坊/钱包 8 页的 DOM 内文本不出现「影策」或「open-ai-canvas」（用户侧文案层）
  - TR-06-02（rule）：注册表单存在 3 个 `<input type="checkbox">` + 按钮 `disabled` 状态随勾选变化
  - TR-06-03（rubric）：随机抽取 5 处空态/404/按钮/引导 CTA，看是否还在使用「点击提交画布子图生成任务」这类技术术语；评分 0–3，阈值 ≥2（电影感 + 温度）

---

## Task 07：幕山投拍 · 向导式创作入口页

- **优先级**：high
- **文件清单**：
  - 新增：`web/src/pages/flow/index.tsx`（Hero greeting + 四 Tab 切换 + 右侧「最近项目」栏）
  - 新增：`web/src/flows/mock-templates.ts`（6 个模板 mock 数据结构：模板名/分类/封面/项目结构）
  - 修改：`web/src/router.tsx`（`/flow` 挂载到 UserLayout 内，登录后默认 landing）
- **验收覆盖**：AC-FL-01
- **TR**：
  - TR-07-01（rule）：页面有四个 `<button role="tab">` 文本匹配「一句话投拍 / 图片创作 / 视频投拍 / 从模板投拍」（全中文）
  - TR-07-02（rule）：一句话投拍 Tab 内 `<textarea>` placeholder 出现「粘贴一段小说原文」关键词；3 chips「都市爽文」「古风言情」「赛博朋克悬疑」存在
  - TR-07-03（rule）：从模板投拍 Tab 存在 6 张模板卡片且每张卡片有「立即套用」按钮，点击后路由跳转到 `/studio/projects/new?template=<slug>`（跳转 200 OK）

---

## Task 08：幕山首映 · Showcase 作品墙 + 创作过程弹窗

- **优先级**：high
- **文件清单**：
  - 新增：`web/src/pages/stage/index.tsx`（公开页，筛选 chips + 卡片网格）
  - 新增：`web/src/stages/mock-showcase.ts`（10 条作品 mock：id/分类/时长/封面/作者/成片URL/过程时间线）
  - 新增：`web/src/stages/components/ShowcaseProcessModal.tsx`（创作过程时间线弹窗 + 底部「🎬 用此模板投拍」按钮）
  - 新增：`web/src/pages/stage/[id].tsx`（详情页，可选一期复用弹窗实现，不必路由）
- **验收覆盖**：AC-FL-02
- **TR**：
  - TR-08-01（rule）：卡片网格渲染 10 条 mock（`data-testid="showcase-card"` count === 10）
  - TR-08-02（rule）：点击某卡片的「查看创作过程」按钮 → `<dialog role="dialog">` 出现，内部存在 5 段时间线标题（剧本/角色/分镜/精渲/合成）+ 底部 CTA 按钮
  - TR-08-03（rule）：未登录用户访问 `/stage` 不被拦截（401/重定向登录）

---

## Task 09：幕山攀登计划 · 邀请码系统（UI + 模型 + 校验空接口）

- **优先级**：high
- **文件清单**（前后端并行）：
  - 前端：
    - 新增：`web/src/pages/creator/invite.tsx`（邀请链接 + 二维码 SVG + 奖励规则区 + 已邀请列表）
    - 修改：`web/src/pages/auth/register.tsx`（邀请码必填字段 + 异步失焦校验：调 `GET /api/invite/:code/validate`）
  - 后端：
    - 新增：`backend/internal/model/models_invite.go`（`InviteCode` + `ReferralReward` 模型）
    - 新增：`backend/internal/service/invite.go`（ValidateInviteCode / CreateInviteBatch / ConsumeReferralReward — 三个方法返回 OK/空实现即可）
    - 新增：`backend/internal/handler/invite.go` + 路由挂载（`invite_routes`）
  - 管理后台：
    - 新增：`web/src/pages/admin/invite-code-panel.tsx`（「批量生成邀请码」入口，调用 `POST /api/admin/invite/generate-batch`）
    - 修改：`admin-shell.tsx` 菜单追加「邀请码管理」
- **验收覆盖**：AC-FL-03
- **TR**：
  - TR-09-01（rule）：`/creator/invite` 页面存在 `<svg id="invite-qr">` 元素 + `<a data-testid="copy-invite-link">` 按钮；奖励规则列出「好友注册 100+200」、「首次充值返 20%」、「Pro 月 10 个」
  - TR-09-02（rule）：`CANVAS_PUBLIC_REGISTRATION=false` 时，邀请码为空 → 注册按钮 disabled；邀请码字段失焦后请求 `/api/invite/TST001/validate` 返回 200 后按钮 enable
  - TR-09-03（rule）：`CANVAS_PUBLIC_REGISTRATION=true` 时，邀请码字段 label 带「（可选）」且按钮无需填写即可 enable
  - TR-09-04（rule）：后端 `InviteCode` / `ReferralReward` 两个 GORM 模型定义文件存在，带有 `gorm.Model` 或 ID 主键标签

---

## Task 10：幕山攀登计划 · 活动 / 赛事系统骨架

- **优先级**：medium
- **文件清单**：
  - 新增：`web/src/pages/creator/activities/index.tsx`（列表卡片）
  - 新增：`web/src/pages/creator/activities/[id].tsx`（详情页 Banner + 时间线 + 奖励阶梯 + 报名表单）
  - 新增：`web/src/creator/mock-activities.ts`（1 条 mock：「第一期幕山投拍挑战赛 · 为故事立一座山」奖池 10000 元）
  - 后端模型：`backend/internal/model/models_activity.go`（`Activity` + `ActivityEntry`）+ service + handler 空方法 + 路由
  - 管理后台：`/admin/activities` CRUD 骨架（复用 `admin-go` 通用页模式）
- **验收覆盖**：AC-FL-04
- **TR**：
  - TR-10-01（rule）：活动列表页存在 1 张卡片，标题含「第一期幕山投拍挑战赛」+ 徽章「进行中」+ 标签「全程免费」
  - TR-10-02（rule）：详情页出现 5 个阶梯步骤（报名/征集/初评/复评/颁奖）+ 报名按钮 + 报名弹窗表单至少 3 个字段
  - TR-10-03（rule）：提交报名后出现「报名成功，参赛资格已激活，奖励 500 积分 7 天有效」Toast

---

## Task 11：底层原子能力矩阵页 `/capabilities`

- **优先级**：medium
- **文件清单**：
  - 新增：`web/src/pages/capabilities/index.tsx`（四列黑白极简卡片 5+11+8+4，纯灰背景 + 黑色文字 + 一处微光强调）
  - 新增：`web/src/capabilities/capabilities.ts`（28 项能力中文改写描述）
- **验收覆盖**：AC-FL-05
- **TR**：
  - TR-11-01（rule）：四列子项分别 count 5、11、8、4
  - TR-11-02（rule）：随机抽取 3 项描述与 WowTV 抓取原文的句子级重叠率 < 80%（简单字符串比对：拿能力名 +「剧本二创/智能修图/文生视频/预设音色」四个锚点中文，如果原句和 WowTV 一样则失败——必须用幕山自己的中文改写）

---

## Task 12：幕山投拍 · 真人转绘向导子流程页 `/flow/redraw`

- **优先级**：medium
- **文件清单**：
  - 新增：`web/src/pages/flow/redraw.tsx`（4 步进度条 + 上传 + 镜头切分模拟 + 6 风格卡片 + 主角模式 Beta 开关 + 投拍按钮）
  - 修改：`web/src/services/api/tasks.ts`（新增 `createRedrawTask(payload)` 接口契约）
  - 修改：`web/src/pages/tasks/index.tsx`（任务列表 Tab 追加「风格转绘」过滤器，渲染占位卡片）
- **验收覆盖**：AC-FL-06
- **TR**：
  - TR-12-01（rule）：存在 4 步进度条且当前步骤高亮
  - TR-12-02（rule）：6 张风格卡片，文本分别含「迪士尼皮克斯 / 吉卜力 / 韩漫唯美 / 美漫英雄 / 国风水墨 / 赛博朋克」六者
  - TR-12-03（rule）：主角模式开关默认关，免费用户点击 switch → 弹出升级模态框（标题出现「主角模式 Pro 权益」）
  - TR-12-04（rule）：提交任务后跳 `/tasks` 且新出现一条「风格转绘」任务卡片，状态为「排队中」

---

## Task 13：主角模式 UI + 角色健康度徽章

- **优先级**：medium
- **文件清单**：
  - 修改：`web/src/pages/projects/[id]/settings-character.tsx`（项目设置→角色一致性 Tab：巨型 switch + 功能说明 + Pro 权益锁）
  - 新增：`web/src/components/canvas/CharacterHealthBadge.tsx`（角色卡右上徽章，0–100 分 + 绿/黄/红色分层）
  - 修改：`web/src/components/canvas/character-card.tsx`（挂载健康度徽章）
  - 修改：`web/src/types/canvas.ts` 或角色相关类型（追加 `metadata.protagonistHealth?: number` 字段注释）
- **验收覆盖**：AC-FL-07
- **TR**：
  - TR-13-01（rule）：开关存在，旁边出现 Pro 徽章角标或锁图标
  - TR-13-02（rule）：构造一个 metadata.health=30 的角色 → 徽章显示红色「30」；=75 → 黄色；=92 → 绿色
  - TR-13-03（rule）：健康度 <70 时，角色卡下方 tooltip 出现「建议补充侧脸、四分之三侧面或高清特写图」

---

## Task 14：项目导出下拉菜单扩展 + Studio 权益锁定

- **优先级**：medium
- **文件清单**：
  - 修改：`web/src/pages/projects/[id]/export-menu.tsx`（或现有导出按钮组件）：从 1–2 项扩展为 5 项，后 3 项锁图标 + 升级引导
  - 新增：`web/src/components/entitlements/UpgradeStudioModal.tsx`（升级引导弹窗复用，主角模式/导出都用）
- **验收覆盖**：AC-FL-08
- **TR**：
  - TR-14-01（rule）：展开导出菜单 count === 5；第 3/4/5 项包含 lock 图标（或 `aria-disabled`）
  - TR-14-02（rule）：点击第 3 项 → `UpgradeStudioModal` 出现，标题包含「Studio 版专享」

---

## Task 15：公开 Pricing 页（未登录看，模糊档位起价 + 联系商务）

- **优先级**：high
- **文件清单**：
  - 新增：`web/src/pages/pricing/index.tsx`（公开页 Hero + 四卡片 + FAQ，黑白极简风格）
  - 新增：`web/src/pages/pricing/ContactBizModal.tsx`（Studio/企业点击「联系商务」弹出表单：姓名/公司/手机号/邮箱/规模/描述）
- **验收覆盖**：AC-PR-01
- **TR**：
  - TR-15-01（rule）：四卡片价格分别为「¥0/永久」、「¥99/月起」、「¥499/月起」、「年付 5 万起，按规模阶梯」（「起」字必须存在）
  - TR-15-02（rule）：Pro 卡片按钮文字是「登录查看详细权益」（不是「立即购买」）
  - TR-15-03（rule）：Enterprise 卡片按钮点击弹出 ContactBizModal，默认收件人显示 contact@mosliy.com

---

## Task 16：登录后 Wallet（积分透明价目表 + 6 档充值 + 模拟支付入账）

- **优先级**：high
- **文件清单**：
  - 新增：`web/src/pages/wallet/index.tsx`（当前积分大字 + 三个 Tab：消耗透明表/充值包/账单明细）
  - 新增：`web/src/pages/wallet/components/CreditConsumptionTable.tsx`（8 行消耗表）
  - 新增：`web/src/pages/wallet/components/CreditPackageGrid.tsx`（6 档卡片 + 微信/支付宝两个模拟支付按钮）
  - 修改：路由 `/wallet` 挂载；顶栏头像下拉追加「我的钱包 · 充值」
  - 后端：`service/finance.go` 追加 `SimulateOrderPaid(orderId)` 方法（直接给用户加积分，供前端「模拟支付成功」按钮调用）
- **验收覆盖**：AC-PR-02
- **TR**：
  - TR-16-01（rule）：消耗透明表行 count === 8；包含「文本生成/文生图/图生图/720p 视频/1080p 视频/TTS/真人转绘/主角模式预检」8 类中的 8（必须 8 条全）
  - TR-16-02（rule）：6 档充值卡价格是 50/100/300/500/1000/5000；积分是 500/1100/3500/6200/13000/70000
  - TR-16-03（rule）：先读取当前积分 X → 点 50 元档「微信模拟支付成功」按钮 → 弹窗 confirm → 再次读取积分，结果 = X + 500（验证真实入账）
  - TR-16-04（rule）：账单明细 Tab 渲染 CreditLedger 列表，最近 20 条有数据（至少存在刚才入账一条）

---

## Task 17：管理后台 · 内容审核骨架

- **优先级**：medium
- **文件清单**：
  - 前端：`web/src/pages/admin/content-audit/index.tsx`（四 Tab：待审核文本/图/视频 + 审核日志）
  - 修改：`admin-shell.tsx` 菜单追加「内容审核」
  - 后端模型：`backend/internal/model/models_content_audit.go`（`ContentAuditRecord`）+ service/handler 空方法 + 路由
  - 配置：`CANVAS_CONTENT_AUDIT_ENABLED` 环境变量开关挂入 Settings 面板
- **验收覆盖**：AC-LG-04
- **TR**：
  - TR-17-01（rule）：菜单能进入且页面渲染 4 Tab 标题正确
  - TR-17-02（rule）：Settings 面板存在「启用内容审核」开关位，默认关闭；能读到 env var
  - TR-17-03（rule）：Flow / 画布生成页提交按钮下方存在合规勾选框（文本：我确认本次输入不违反社区规范与法律，同意内容被自动审核）

---

## Phase-2 未来规划（不在一期 17 任务内，仅作上下文记录）

> 以下条目属于未来迭代，**不视为「一期被取消」**，而是「一期从未规划入 17 任务」。一期 spec 已为其中部分预留 UI 入口与 Beta 徽章占位（如主角模式）。

- 草稿草图锁定（DramaClaw 护城河 Phase-2）
- 360° 导演世界 V1（Phase-2）
- 资产 Prompt 中间件（Phase-2）
- Canvas Agent / Codex 插件重命名（一期允许保留旧名）
- Docker compose 服务名/镜像名重命名（部署层非用户可见）
- 真实微信/支付宝 SDK、第三方审核 SDK、飞书机器人签到接入
- H5 端完整 UI 适配（一期只要求移动响应式骨架 + 断点不破版）
