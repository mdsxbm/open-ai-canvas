# 幕山 Moshine 品牌设计素材包

本目录整理了「幕山 Moshine」品牌的全部设计素材，用于在 open-ai-canvas（或其他项目）中直接替换品牌。
不做二次开发也可以拿走用。

## 目录结构

```
moshine-brand-assets/
├── README.md                    # 本文件：使用说明
├── brand-spec.md                # 完整品牌规格文档（幕山品牌定义、色板、Logo、命名、验收标准）
├── LICENSE.brand                # 商业品牌声明（版权归部署方，底层代码基于 MIT）
├── naming.md                    # 品牌命名与文案体系（产品矩阵、Slogan、语气、版权行）
├── logo/
│   ├── moshine-mark.svg         # 图形 Mark：幕布齿孔 + 三竖山峰（44×44 圆角方块）
│   ├── moshine-logo-full.svg    # 完整 Logo：Mark + 「幕山」字标 + Moshine 副标
│   ├── favicon.svg              # 网站图标（32×32，纯黑底白形）
│   └── moshine-logo.tsx         # React 组件（支持 wordmark/mark/both 三种变体 + 明暗主题）
├── tokens/
│   └── brand-tokens.css         # 品牌语义色 Token（--brand / --accent 等，含明暗主题）
└── templates/
    ├── index.head.html          # <head> 替换片段（title / meta description / og:* / favicon）
    ├── page-head.tsx            # 页面级 <head> 元数据 React 组件（自动拼接品牌 title 后缀）
    └── footer.html              # 页脚品牌片段（含 MIT 二次改造声明）
```

## 快速替换清单

### 1. Logo 与图标
- 网站 favicon：用 `logo/favicon.svg` 替换原项目 `public/favicon` 或 `index.html` 的 `<link rel="icon">`。
- 顶栏 / 登录页 / 页脚 Logo：用 `logo/moshine-logo-full.svg`，或 React 项目用 `logo/moshine-logo.tsx` 组件。

### 2. 品牌色
- 将 `tokens/brand-tokens.css` 的 `:root` 与 `.dark` 两块追加到全局 CSS。
- 主色用 `var(--brand)`，强调色用 `var(--accent)`，文字对比用 `var(--brand-contrast)`。
- Ant Design 的 `colorPrimary` 指向 `var(--brand)`（幕山黑）。

### 3. 页面标题与 Meta
- 用 `templates/index.head.html` 替换 `index.html` 的 `<head>` 中 title / meta / favicon 部分。
- React 项目可用 `templates/page-head.tsx` 组件，每个页面传 `title` 即可自动拼接：
  `{页面名} · 幕山 Moshine — 每一帧，都值得立一座山。`

### 4. 命名与文案
- 产品矩阵导航命名见 `naming.md`（幕山工作坊 / 幕山投拍 / 幕山首映 / 幕山攀登计划）。
- Slogan、空态文案、按钮行动动词、版权行见 `naming.md`。

### 5. 法律声明
- 根目录放 `LICENSE.brand`，页脚保留「基于 MIT 开源的影策 open-ai-canvas 二次改造」一行（见 `templates/footer.html`）。
- 这是 fork 后闭源商用不违反 MIT 协议的底线（MIT 要求保留原作者版权声明）。

## 品牌定位速览

- **风格**：极致黑白极简 · 高端创作工业感（Linear / Notion 路线）
- **主色**：幕山黑（neutral-950），强调色：极淡冷灰（neutral-200），**无渐变**
- **Logo**：纯黑圆角方块 + 负形「幕布齿孔 + 三竖山峰」，字标「幕山」
- **Slogan**：幕山 · 每一帧，都值得立一座山。 / Moshine — Every frame, a mountain.
- **域名**：mosliy.com

详细规格见 `brand-spec.md`。
