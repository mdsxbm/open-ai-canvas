import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import type { ReactNode } from "react";

import { AppFooter } from "@/components/layout/app-footer";
import { MoshineLogo } from "@/components/brand/moshine-logo";

/**
 * 幕山 Moshine 法律文档外壳（spec §4.1）
 *
 * 公开页布局：顶栏（Logo + 返回首页）→ 文档正文 → Footer。
 * 不需要登录态，不包裹 UserLayout（避免拉起工作台侧栏）。
 *
 * 验收映射：AC-LG-01、TR-02-01
 */

interface LegalPageShellProps {
    /** 文档标题（页头 H1） */
    title: string;
    /** 文档 slug，用于后端 /api/legal/:doc 接口占位 */
    docSlug: "user-agreement" | "privacy" | "dmca" | "disclaimer";
    /** 最近更新日期（YYYY-MM-DD） */
    updatedAt: string;
    /** 章节正文 */
    children: ReactNode;
}

const LEGAL_EMAIL = "legal@mosliy.com";

const RELATED_LINKS: { label: string; to: string }[] = [
    { label: "用户协议", to: "/legal/user-agreement" },
    { label: "隐私政策", to: "/legal/privacy" },
    { label: "版权投诉", to: "/legal/dmca" },
    { label: "免责声明", to: "/legal/disclaimer" },
];

export function LegalPageShell({ title, docSlug, updatedAt, children }: LegalPageShellProps) {
    return (
        <div className="app-legal-shell flex min-h-dvh flex-col bg-[var(--bg)] text-[var(--brand)]">
            {/* 顶栏：Logo + 返回首页 */}
            <header className="app-legal-topbar sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--workspace-border)] bg-[var(--bg)]/95 px-6 backdrop-blur-md lg:px-10">
                <Link to="/" className="inline-flex items-center gap-2" aria-label="返回幕山首页">
                    <MoshineLogo variant="both" size="sm" showEnglishSubtitle={false} />
                </Link>
                <Link
                    to="/"
                    className="app-legal-back inline-flex items-center gap-1.5 rounded-md border border-[var(--workspace-border)] px-3 py-1.5 text-[var(--fs-caption)] text-[var(--brand)] transition-colors hover:bg-[var(--brand-soft)]"
                    aria-label="返回首页"
                >
                    <ArrowLeft className="size-3.5" strokeWidth={1.8} />
                    返回首页
                </Link>
            </header>

            {/* 文档正文 */}
            <main className="app-legal-main mx-auto w-full max-w-[860px] flex-1 px-6 py-12 lg:px-8 lg:py-16">
                <p className="app-legal-doc-slug text-[var(--fs-tiny)] uppercase tracking-widest text-[var(--brand)] opacity-50">
                    {docSlug}
                </p>
                <h1 className="app-legal-title mt-2 text-[var(--fs-display)] font-bold leading-tight text-[var(--brand)]">
                    {title}
                </h1>
                <p className="app-legal-updated mt-3 text-[var(--fs-caption)] text-[var(--brand)] opacity-65">
                    最近更新日期：{updatedAt} · 幕山 Moshine
                </p>

                <div className="app-legal-body mt-10 space-y-8 text-[var(--fs-body)] leading-[1.75] text-[var(--brand)] opacity-90">
                    {children}
                </div>

                {/* 关联法律文档 */}
                <nav
                    className="app-legal-related mt-16 border-t border-[var(--workspace-border)] pt-8"
                    aria-label="关联法律文档"
                >
                    <p className="text-[var(--fs-label)] font-semibold uppercase tracking-wider text-[var(--brand)] opacity-75">
                        关联法律文档
                    </p>
                    <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                        {RELATED_LINKS.map((link) => (
                            <li key={link.to}>
                                <Link
                                    to={link.to}
                                    className="text-[var(--fs-caption)] text-[var(--brand)] opacity-65 transition-opacity hover:opacity-100"
                                >
                                    {link.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* 联系方式 */}
                <p className="app-legal-contact mt-8 text-[var(--fs-caption)] text-[var(--brand)] opacity-65">
                    如有疑问请联系{" "}
                    <a
                        href={`mailto:${LEGAL_EMAIL}`}
                        className="underline decoration-dotted underline-offset-4 hover:opacity-100"
                    >
                        {LEGAL_EMAIL}
                    </a>
                    。
                </p>

                <p className="app-legal-signature mt-6 text-[var(--fs-tiny)] text-[var(--brand)] opacity-45">
                    幕山 Moshine · 每一帧，都值得立一座山。
                </p>
            </main>

            {/* 全局 Footer */}
            <AppFooter />
        </div>
    );
}
