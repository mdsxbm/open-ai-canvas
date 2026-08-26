import { useMemo, useState } from "react";
import { Button } from "antd";
import { ArrowLeft, Film } from "lucide-react";
import { Link } from "react-router";

import { AppFooter } from "@/components/layout/app-footer";
import { MoshineLogo } from "@/components/brand/moshine-logo";
import { PageHead } from "@/components/brand/page-head";
import { ShowcaseProcessModal } from "@/stages/components/ShowcaseProcessModal";
import { SHOWCASE_WORKS } from "@/stages/mock-showcase";
import type { ShowcaseWork } from "@/stages/mock-showcase";

/**
 * 幕山首映 · Showcase 作品墙（spec Task 08）
 *
 * 公开页，未登录可访问：顶栏（Logo + 返回首页）→ Hero → 筛选 chips →
 * 10 条作品卡片网格 → 创作过程弹窗 → Footer。
 *
 * 所有颜色走 CSS var（--brand / --brand-soft / --bg / --bg-secondary /
 * --workspace-border / --accent），黑白极简；不引入第三方库。
 * 验收映射：AC-FL-02、TR-08-01、TR-08-02、TR-08-03
 */

type ShowcaseFilter = "全部" | "剧本驱动" | "画面驱动" | "风格转绘";

const FILTER_CHIPS: ShowcaseFilter[] = ["全部", "剧本驱动", "画面驱动", "风格转绘"];

export default function StagePage() {
    const [filter, setFilter] = useState<ShowcaseFilter>("全部");
    const [activeWork, setActiveWork] = useState<ShowcaseWork | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const visibleWorks = useMemo(() => {
        if (filter === "全部") return SHOWCASE_WORKS;
        return SHOWCASE_WORKS.filter((work) => work.category === filter);
    }, [filter]);

    const openProcess = (work: ShowcaseWork) => {
        setActiveWork(work);
        setModalOpen(true);
    };

    const closeProcess = () => {
        setModalOpen(false);
    };

    return (
        <div className="app-stage-shell flex min-h-dvh flex-col bg-[var(--bg)] text-[var(--brand)]">
            <PageHead
                title="幕山首映"
                description="幕山 Moshine 首映 · 看看其他创作者如何用幕山拍出他们的故事。"
            />

            {/* 顶栏：Logo + 返回首页（复用公开页外壳模式，不拉起工作台侧栏） */}
            <header className="app-stage-topbar sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--workspace-border)] bg-[var(--bg)]/95 px-6 backdrop-blur-md lg:px-10">
                <Link to="/" className="inline-flex items-center gap-2" aria-label="返回幕山首页">
                    <MoshineLogo variant="both" size="sm" showEnglishSubtitle={false} />
                </Link>
                <Link
                    to="/"
                    className="app-stage-back inline-flex items-center gap-1.5 rounded-md border border-[var(--workspace-border)] px-3 py-1.5 text-[var(--fs-caption)] text-[var(--brand)] transition-colors hover:bg-[var(--brand-soft)]"
                    aria-label="返回首页"
                >
                    <ArrowLeft className="size-3.5" strokeWidth={1.8} />
                    返回首页
                </Link>
            </header>

            {/* Hero 区 */}
            <section className="app-stage-hero mx-auto w-full max-w-7xl px-6 pt-16 pb-8 lg:px-8 lg:pt-20">
                <div className="mb-5 h-0.5 w-10 bg-[var(--accent)]" aria-hidden="true" />
                <h1 className="text-[var(--fs-display)] font-semibold leading-tight text-[var(--brand)]">
                    幕山 · 首映
                </h1>
                <p className="mt-4 text-[var(--fs-body-lg)] text-[var(--brand)] opacity-65">
                    看看其他创作者如何用幕山拍出他们的故事。
                </p>
            </section>

            {/* 筛选 chips */}
            <section className="app-stage-filters mx-auto w-full max-w-7xl px-6 lg:px-8">
                <div role="group" aria-label="作品分类筛选" className="flex flex-wrap items-center gap-2">
                    {FILTER_CHIPS.map((chip) => {
                        const active = chip === filter;
                        return (
                            <button
                                key={chip}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setFilter(chip)}
                                className="inline-flex h-9 items-center rounded-md px-3 text-[var(--fs-caption)] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                                style={
                                    active
                                        ? { background: "var(--brand)", color: "var(--brand-contrast)" }
                                        : { background: "var(--brand-soft)", color: "var(--brand)" }
                                }
                            >
                                {chip}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* 卡片网格 */}
            <section className="app-stage-grid mx-auto w-full max-w-7xl px-6 py-10 lg:px-8 lg:py-12">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleWorks.map((work) => (
                        <article
                            key={work.id}
                            data-testid="showcase-card"
                            className="app-stage-card flex flex-col overflow-hidden rounded-lg bg-[var(--bg-secondary)]"
                        >
                            {/* 占位封面 */}
                            <div className="relative flex aspect-[4/3] items-center justify-center bg-[var(--brand-soft)]">
                                <Film
                                    className="size-8 text-[var(--brand)] opacity-30"
                                    strokeWidth={1.5}
                                    aria-hidden="true"
                                />
                                <span className="absolute bottom-2 left-3 text-[var(--fs-tiny)] text-[var(--brand)] opacity-50">
                                    {work.coverSlug}
                                </span>
                            </div>

                            {/* 卡片正文 */}
                            <div className="flex flex-1 flex-col gap-3 p-5">
                                <h3 className="text-[var(--fs-body-lg)] font-semibold text-[var(--brand)]">
                                    {work.title}
                                </h3>
                                <p className="text-[var(--fs-caption)] text-[var(--brand)] opacity-65">
                                    {work.category} · {work.duration} · {work.author}
                                </p>
                                <div className="mt-auto pt-2">
                                    <Button onClick={() => openProcess(work)}>查看创作过程</Button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            {/* 全局 Footer */}
            <AppFooter />

            {/* 创作过程弹窗 */}
            <ShowcaseProcessModal
                open={modalOpen}
                work={activeWork}
                onClose={closeProcess}
            />
        </div>
    );
}
