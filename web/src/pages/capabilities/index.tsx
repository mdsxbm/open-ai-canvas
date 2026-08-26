import { PageHead } from "@/components/brand/page-head";
import { CAPABILITY_GROUPS } from "@/capabilities/capabilities";

/**
 * 幕山 Moshine · 底层能力矩阵页 `/capabilities`（spec Task 11）
 *
 * 四列黑白极简卡片矩阵：文本与剧本 / 画面与镜头 / 声音与音轨 / 工作流与协作。
 * 所有颜色均使用 CSS var，避免裸 Tailwind 任意值；文案全中文。
 *
 * 验收映射：AC-FL-05、TR-11-01、TR-11-02
 */
export default function CapabilitiesPage() {
    return (
        <main className="capabilities-page min-h-dvh bg-[var(--bg)] text-[var(--brand)]">
            <PageHead title="幕山能力" />

            {/* Hero 区 */}
            <section className="mx-auto w-full max-w-7xl px-6 pt-16 pb-10 lg:px-8 lg:pt-20">
                {/* 一处微光强调：以 var(--accent) 色作克制的引导条 */}
                <div className="mb-5 h-0.5 w-10 bg-[var(--accent)]" aria-hidden="true" />
                <h1 className="text-[var(--fs-display)] font-semibold leading-tight text-[var(--brand)]">
                    幕山 · 底层能力矩阵
                </h1>
                <p className="mt-4 text-[var(--fs-body-lg)] text-[var(--brand)] opacity-65">
                    28 项原子能力，撑起每一帧的诞生。
                </p>
            </section>

            {/* 四列能力矩阵 */}
            <section className="mx-auto w-full max-w-7xl px-6 pb-20 lg:px-8">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {CAPABILITY_GROUPS.map((group) => (
                        <div key={group.title} className="flex min-w-0 flex-col">
                            <h2 className="border-b border-[var(--workspace-border)] pb-3 text-[var(--fs-heading-lg)] font-semibold text-[var(--brand)]">
                                {group.title}
                            </h2>
                            <p className="mt-3 text-[var(--fs-caption)] leading-5 text-[var(--brand)] opacity-65">
                                {group.summary}
                            </p>
                            <ul className="mt-4 space-y-3">
                                {group.items.map((item) => (
                                    <li
                                        key={item.name}
                                        className="rounded-md border border-[var(--workspace-border)] bg-[var(--bg-secondary)] p-3"
                                    >
                                        <h3 className="text-[var(--fs-body)] font-medium text-[var(--brand)]">
                                            {item.name}
                                        </h3>
                                        <p className="mt-1.5 text-[var(--fs-caption)] leading-5 text-[var(--brand)] opacity-65">
                                            {item.description}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
