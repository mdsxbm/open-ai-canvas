/**
 * PageHead：页面级 <head> 元数据注入（spec Task 04）
 *
 * 使用 React 19 原生 hoist 能力，将 <title>、<meta>、<link> 直接渲染到 <head>，
 * 不依赖 react-helmet-async 等第三方库。
 *
 * title 拼接规则：
 *   传入 title：`${title} · 幕山 Moshine — 每一帧，都值得立一座山。`
 *   不传 title：`幕山 Moshine — 每一帧，都值得立一座山。`
 *
 * 任一页面调用 <PageHead title="我的钱包" /> 后，
 * 浏览器 tab 显示 `我的钱包 · 幕山 Moshine — 每一帧，都值得立一座山。`
 * 满足 TR-04-01：尾部 substring = "· 幕山 Moshine — 每一帧，都值得立一座山。"
 */

export interface PageHeadProps {
    /** 当前页面中文短标题，例如「我的钱包」「幕山首映」 */
    title?: string;
    /** 覆盖默认 meta description */
    description?: string;
    /** Open Graph 图片绝对 URL */
    ogImage?: string;
    /** canonical URL，默认 https://mosliy.com */
    canonicalUrl?: string;
}

const SITE_NAME = "幕山 Moshine";
const SITE_URL = "https://mosliy.com";
const SLOGAN_SUFFIX = " · 幕山 Moshine — 每一帧，都值得立一座山。";
const DEFAULT_TITLE = "幕山 Moshine — 每一帧，都值得立一座山。";
const DEFAULT_DESCRIPTION =
    "幕山 Moshine（mosliy.com）— 面向中文创作者的 AI 影视工作台。剧本生成、分镜规划、画面渲染、视频合成一站成片。";

export function PageHead({ title, description, ogImage, canonicalUrl }: PageHeadProps) {
    const fullTitle = title ? `${title}${SLOGAN_SUFFIX}` : DEFAULT_TITLE;
    const desc = description ?? DEFAULT_DESCRIPTION;
    const canonical = canonicalUrl ?? SITE_URL;
    return (
        <>
            <title>{fullTitle}</title>
            <meta name="description" content={desc} />
            <link rel="canonical" href={canonical} />
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:type" content="website" />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={desc} />
            <meta property="og:url" content={canonical} />
            {ogImage ? <meta property="og:image" content={ogImage} /> : null}
        </>
    );
}

export default PageHead;
