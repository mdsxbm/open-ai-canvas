import { Link } from "react-router";

import { MoshineLogo } from "@/components/brand/moshine-logo";

/**
 * 幕山 Moshine 全局 Footer（spec §4.2 四列布局）
 *
 * 列 1 产品：四矩阵导航 + 底层能力 + 定价
 * 列 2 资源：帮助中心 / 教程 / 联系商务 / 法律协议
 * 列 3 社区：4 个二维码占位（公众号 / 视频号 / 飞书群 / 邮箱）
 * 列 4 品牌标志：Logo + Slogan + 版权行（保留 MIT 二次改造声明）
 *
 * 验收映射：AC-LG-03、TR-02-02、TR-02-03
 */

interface FooterLink {
    label: string;
    to?: string;
    href?: string;
}

interface FooterColumn {
    title: string;
    links: FooterLink[];
}

const PRODUCT_LINKS: FooterColumn = {
    title: "产品",
    links: [
        { label: "幕山工作坊", to: "/studio/projects" },
        { label: "幕山投拍", to: "/flow" },
        { label: "幕山首映", to: "/stage" },
        { label: "幕山攀登计划", to: "/creator/invite" },
        { label: "底层能力矩阵", to: "/capabilities" },
        { label: "定价方案", to: "/pricing" },
    ],
};

const RESOURCE_LINKS: FooterColumn = {
    title: "资源",
    links: [
        { label: "帮助中心", href: "https://mosliy.com/help" },
        { label: "教程文档", href: "https://mosliy.com/docs" },
        { label: "联系商务", href: "mailto:contact@mosliy.com" },
        { label: "用户协议", to: "/legal/user-agreement" },
        { label: "隐私政策", to: "/legal/privacy" },
        { label: "版权投诉", to: "/legal/dmca" },
        { label: "免责声明", to: "/legal/disclaimer" },
    ],
};

interface CommunityQrItem {
    label: string;
    subLabel: string;
}

const COMMUNITY_QRS: CommunityQrItem[] = [
    { label: "微信公众号", subLabel: "幕山 Moshine" },
    { label: "视频号", subLabel: "幕山创作台" },
    { label: "飞书话题群", subLabel: "幕山创作者官方群" },
    { label: "官方邮箱", subLabel: "hello@mosliy.com" },
];

/** 二维码占位：纯灰底 + 黑色边框 + 居中 QR 图标（SVG 自绘），无图片依赖 */
function QrPlaceholder({ label, subLabel }: CommunityQrItem) {
    return (
        <div className="app-footer-qr flex flex-col items-center gap-1.5">
            <span
                className="grid size-16 place-items-center rounded-md border border-[var(--workspace-border)] bg-[var(--brand-soft)]"
                aria-label={`${label}二维码`}
                role="img"
            >
                <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                >
                    {/* 极简 QR 占位：四角定位 + 中心十字 */}
                    <rect x="2" y="2" width="6" height="6" rx="1" stroke="var(--brand)" strokeWidth="1.4" />
                    <rect x="16" y="2" width="6" height="6" rx="1" stroke="var(--brand)" strokeWidth="1.4" />
                    <rect x="2" y="16" width="6" height="6" rx="1" stroke="var(--brand)" strokeWidth="1.4" />
                    <rect x="9" y="9" width="6" height="6" rx="1" fill="var(--brand)" />
                    <rect x="16" y="16" width="4" height="4" rx="0.5" fill="var(--brand)" opacity="0.55" />
                </svg>
            </span>
            <span className="app-footer-qr-label text-center text-[var(--fs-tiny)] font-medium text-[var(--brand)]">
                {label}
            </span>
            <span className="text-center text-[var(--fs-micro)] text-[var(--brand)] opacity-55">
                {subLabel}
            </span>
        </div>
    );
}

function renderLink(item: FooterLink, index: number) {
    const className =
        "text-[var(--fs-caption)] text-[var(--brand)] opacity-65 transition-opacity hover:opacity-100";
    if (item.to) {
        return (
            <Link key={`${item.label}-${index}`} to={item.to} className={className}>
                {item.label}
            </Link>
        );
    }
    return (
        <a
            key={`${item.label}-${index}`}
            href={item.href ?? "#"}
            className={className}
            target={item.href?.startsWith("http") ? "_blank" : undefined}
            rel={item.href?.startsWith("http") ? "noopener noreferrer" : undefined}
        >
            {item.label}
        </a>
    );
}

export function AppFooter() {
    const year = new Date().getFullYear();
    return (
        <footer
            className="app-footer border-t border-[var(--workspace-border)] bg-[var(--bg-secondary)]"
            role="contentinfo"
        >
            <div className="app-footer-grid mx-auto grid w-full max-w-[1200px] grid-cols-2 gap-8 px-6 py-10 lg:grid-cols-4 lg:gap-12 lg:px-10 lg:py-14">
                {/* 列 1：产品 */}
                <nav className="app-footer-col flex flex-col gap-2.5" aria-label="产品导航">
                    <h3 className="text-[var(--fs-label)] font-semibold uppercase tracking-wider text-[var(--brand)] opacity-80">
                        {PRODUCT_LINKS.title}
                    </h3>
                    {PRODUCT_LINKS.links.map((item, i) => renderLink(item, i))}
                </nav>

                {/* 列 2：资源 */}
                <nav className="app-footer-col flex flex-col gap-2.5" aria-label="资源链接">
                    <h3 className="text-[var(--fs-label)] font-semibold uppercase tracking-wider text-[var(--brand)] opacity-80">
                        {RESOURCE_LINKS.title}
                    </h3>
                    {RESOURCE_LINKS.links.map((item, i) => renderLink(item, i))}
                </nav>

                {/* 列 3：社区 */}
                <div className="app-footer-col flex flex-col gap-3" aria-label="社区">
                    <h3 className="text-[var(--fs-label)] font-semibold uppercase tracking-wider text-[var(--brand)] opacity-80">
                        社区
                    </h3>
                    <div className="app-footer-qr-grid grid grid-cols-2 gap-3">
                        {COMMUNITY_QRS.map((qr) => (
                            <QrPlaceholder key={qr.label} {...qr} />
                        ))}
                    </div>
                </div>

                {/* 列 4：品牌标志 */}
                <div className="app-footer-col flex flex-col gap-3" aria-label="品牌">
                    <MoshineLogo
                        variant="both"
                        size="lg"
                        showEnglishSubtitle
                        showSlogan
                        href="https://mosliy.com"
                    />
                    <p className="text-[var(--fs-micro)] text-[var(--brand)] opacity-55">
                        © {year} 幕山 Moshine. All rights reserved.
                        <br />
                        基于 MIT 开源的影策 open-ai-canvas 二次改造。
                    </p>
                </div>
            </div>
        </footer>
    );
}
