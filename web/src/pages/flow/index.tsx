import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input } from "antd";
import { Link, useNavigate } from "react-router";

import { PageHead } from "@/components/brand/page-head";
import { FLOW_TEMPLATES } from "@/flows/mock-templates";
import { CATEGORY_RAILS, classifyCanvas, formatRelativeTime, GalleryCard, type GalleryCategory } from "@/pages/home/gallery";
import { ComplianceCheckbox } from "@/pages/flow/compliance-checkbox";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { useUserStore } from "@/stores/use-user-store";

// 幕山投拍向导 4 个 Tab：用原生 button 实现，不走 AntD Tabs（Task 07 约束）。
type FlowTabKey = "one-liner" | "image" | "video" | "template";

const ONE_LINER_CHIPS = [
    "都市爽文",
    "古风言情",
    "赛博朋克悬疑",
];
const IMAGE_RATIOS = ["1:1", "3:4", "16:9"];
const VIDEO_DURATIONS = ["5s", "10s"];
const VIDEO_RESOLUTIONS = ["720p", "1080p"];

// 投拍模式 tab 标签：顶部横栏和表单头共用，避免散落字面量
const TAB_LABELS: Record<FlowTabKey, string> = {
    "one-liner": "一句话投拍",
    image: "图片创作",
    video: "视频投拍",
    template: "从模板投拍",
};

// 循环打字机：逐字写入 → 停顿 → 逐字删除 → 重新开始，给首屏大标题动感
// 用 ref 持有计时器，避免每帧 setState 触发不必要的 effect 重跑
const HERO_TITLE = "今天想拍什么？";
function useTypewriterLoop(text: string) {
    const [display, setDisplay] = useState("");
    const [phase, setPhase] = useState<"typing" | "pausing" | "deleting">("typing");
    const indexRef = useRef(0);
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (phase === "typing") {
            if (indexRef.current < text.length) {
                timer = setTimeout(() => {
                    indexRef.current += 1;
                    setDisplay(text.slice(0, indexRef.current));
                }, 120);
            } else {
                // 打完停 1.6s 再开始删除
                timer = setTimeout(() => setPhase("deleting"), 1600);
            }
        } else if (phase === "deleting") {
            if (indexRef.current > 0) {
                timer = setTimeout(() => {
                    indexRef.current -= 1;
                    setDisplay(text.slice(0, indexRef.current));
                }, 60);
            } else {
                // 删完短暂停 0.4s 再重新打
                timer = setTimeout(() => setPhase("typing"), 400);
            }
        }
        return () => clearTimeout(timer);
    }, [phase, display, text]);
    return display;
}

export default function FlowPage() {
    const navigate = useNavigate();
    // 大标题打字机循环：逐字写入/删除，给首屏动感
    const heroTitle = useTypewriterLoop(HERO_TITLE);
    // 默认 video：幕山投拍定位"从想法到一镜成片"，视频是核心产出
    const [active, setActive] = useState<FlowTabKey>("video");
    // 作品广场分类筛选：复用 home 页的 GalleryCategory 与 classifyCanvas，让首屏画廊可按节点类型筛作品
    const [galleryCategory, setGalleryCategory] = useState<GalleryCategory>("all");
    const user = useUserStore((state) => state.user);
    const canvasProjects = useCanvasStore((state) => state.projects);
    // 独立画布 = projectId 为空，按 updatedAt 倒序取前 3，作为最近项目占位。
    const recentProjects = useMemo(
        () => canvasProjects.filter((project) => !project.projectId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 3),
        [canvasProjects],
    );
    // 作品广场：按分类筛选画布，"全部"显示所有，其他按主导节点类型筛；按更新时间倒序
    const galleryCanvases = useMemo(
        () => canvasProjects
            .filter((project) => galleryCategory === "all" || classifyCanvas(project) === galleryCategory)
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
        [canvasProjects, galleryCategory],
    );

    return (
        <main className="app-user-content app-workspace-canvas app-workspace-scroll h-full overflow-y-auto text-foreground">
            <PageHead title="幕山投拍" />
            {/* 首屏：背景视频/图撑满 + 投拍表单居中浮层（neodomain 风格）
                视频背景接口：有 /inspiration/hero.mp4 时自动播放静音循环，否则回退 cyberpunk-neon.jpg + Ken Burns */}
            <section className="app-flow-hero">
                <div className="app-flow-hero-bg" aria-hidden="true">
                    <video
                        className="app-flow-hero-video"
                        autoPlay
                        loop
                        muted
                        playsInline
                        poster="/inspiration/cyberpunk-neon.jpg"
                    >
                        <source src="/inspiration/hero.mp4" type="video/mp4" />
                    </video>
                </div>
                <div className="app-flow-hero-overlay" aria-hidden="true" />
                <div className="app-flow-hero-content">
                    <div className="app-flow-hero-greeting">
                        <h1 className="app-flow-hero-title">
                            <span className="app-flow-hero-title-text">{heroTitle}</span>
                            <span className="app-flow-hero-cursor" aria-hidden="true" />
                        </h1>
                        <p className="app-flow-hero-subtitle">幕山投拍 · 从一个想法到一镜成片，最快 30 秒。</p>
                    </div>
                    <nav className="app-flow-hero-tabs" role="tablist" aria-label="投拍模式">
                        {(["one-liner", "video", "image", "template"] as const).map((key) => {
                            const selected = active === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={selected}
                                    onClick={() => setActive(key)}
                                    className={`app-flow-hero-tab ${selected ? "is-active" : ""}`}
                                >
                                    {TAB_LABELS[key]}
                                </button>
                            );
                        })}
                    </nav>
                    <div className="app-flow-hero-composer">
                        {active === "one-liner" ? <OneLinerPanel /> : null}
                        {active === "image" ? <ImagePanel /> : null}
                        {active === "video" ? <VideoPanel /> : null}
                        {active === "template" ? <TemplatePanel onApply={(slug) => navigate(`/studio/projects/new?template=${slug}`)} /> : null}
                    </div>
                </div>
            </section>

            {/* 作品广场：移到首屏下方，分类导航 + 真实画布作品网格 */}
            <section className="app-flow-gallery">
                <div className="app-flow-gallery-head">
                    <h2>作品广场</h2>
                    <p>点击一张，进入画布继续创作</p>
                </div>
                <nav className="app-home-category-rail" aria-label="作品分类">
                    {CATEGORY_RAILS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            aria-pressed={galleryCategory === item.key}
                            className={`app-home-category-chip ${galleryCategory === item.key ? "is-active" : ""}`}
                            onClick={() => setGalleryCategory(item.key)}
                        >
                            {item.icon}<span>{item.label}</span>
                        </button>
                    ))}
                </nav>
                {galleryCanvases.length ? (
                    <div className="app-home-gallery">
                        {galleryCanvases.map((project) => <GalleryCard key={project.id} project={project} />)}
                    </div>
                ) : (
                    <div className="app-home-gallery-empty">这个分类下还没有画布，换个分类看看，或上方投拍一个新的。</div>
                )}
            </section>

            {/* 最近项目侧栏：移到画廊下方，作为补充入口 */}
            {user && recentProjects.length ? (
                <section className="app-flow-recent">
                    <div className="app-flow-recent-head">
                        <h2>最近项目</h2>
                        <p>回到上次的创作</p>
                    </div>
                    <div className="app-flow-recent-list">
                        {recentProjects.map((project) => (
                            <Link
                                key={project.id}
                                to={`/projects/${project.id}`}
                                className="app-flow-recent-item"
                            >
                                <span className="block truncate text-sm font-medium">{project.title}</span>
                                <span className="mt-1 block text-xs text-foreground/45">更新于 {formatRelativeTime(project.updatedAt)}</span>
                            </Link>
                        ))}
                    </div>
                </section>
            ) : null}
        </main>
    );
}

function OneLinerPanel() {
    const [text, setText] = useState("");
    const [compliant, setCompliant] = useState(false);
    const appendChip = (label: string) => setText((prev) => (prev.trim() ? `${prev}\n#${label} ` : `#${label} `));
    return (
        <div className="space-y-4">
            <Input.TextArea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="粘贴一段小说原文，或写下一个画面灵感……"
                autoSize={{ minRows: 5, maxRows: 12 }}
            />
            <div className="flex flex-wrap items-center gap-2">
                {ONE_LINER_CHIPS.map((label) => (
                    <button
                        key={label}
                        type="button"
                        onClick={() => appendChip(label)}
                        className="inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                        style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <Button type="primary" disabled={!compliant || !text.trim()} onClick={() => undefined}>立即投拍</Button>
            <ComplianceCheckbox checked={compliant} onChange={setCompliant} />
        </div>
    );
}

function ImagePanel() {
    const [text, setText] = useState("");
    const [ratio, setRatio] = useState("1:1");
    return (
        <div className="space-y-4">
            <Input.TextArea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="描述你想看到的画面……"
                autoSize={{ minRows: 5, maxRows: 12 }}
            />
            <div className="flex flex-wrap items-center gap-2">
                {IMAGE_RATIOS.map((value) => {
                    const selected = ratio === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setRatio(value)}
                            className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                            style={selected ? { background: "var(--brand)", color: "var(--brand-contrast)" } : { background: "var(--brand-soft)", color: "var(--brand)" }}
                        >
                            {value}
                        </button>
                    );
                })}
            </div>
            <Button type="primary">立即出图</Button>
        </div>
    );
}

function VideoPanel() {
    const [text, setText] = useState("");
    const [duration, setDuration] = useState("5s");
    const [resolution, setResolution] = useState("720p");
    return (
        <div className="space-y-4">
            <Input.TextArea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="描述这一镜的运镜与画面……"
                autoSize={{ minRows: 5, maxRows: 12 }}
            />
            {/* 真人转绘子流程入口（spec Task 12）：已有实拍素材时走 4 步向导。 */}
            <Link
                to="/flow/redraw"
                className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm transition hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
            >
                <span className="text-foreground/70">已有真人实拍？直接转绘成动画风格 →</span>
                <span className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>真人转绘 Beta</span>
            </Link>
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-foreground/55">时长</span>
                    {VIDEO_DURATIONS.map((value) => {
                        const selected = duration === value;
                        return (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setDuration(value)}
                                className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                                style={selected ? { background: "var(--brand)", color: "var(--brand-contrast)" } : { background: "var(--brand-soft)", color: "var(--brand)" }}
                            >
                                {value}
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-foreground/55">分辨率</span>
                    {VIDEO_RESOLUTIONS.map((value) => {
                        const selected = resolution === value;
                        return (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setResolution(value)}
                                className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                                style={selected ? { background: "var(--brand)", color: "var(--brand-contrast)" } : { background: "var(--brand-soft)", color: "var(--brand)" }}
                            >
                                {value}
                            </button>
                        );
                    })}
                </div>
            </div>
            <Button type="primary">立即拍片</Button>
        </div>
    );
}

function TemplatePanel({ onApply }: { onApply: (slug: string) => void }) {
    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {FLOW_TEMPLATES.map((tpl) => (
                <article key={tpl.slug} className="flex flex-col overflow-hidden rounded-lg border border-border/80 bg-card">
                    <div className="aspect-[4/3] w-full bg-[var(--brand-soft)]" aria-label={tpl.name} />
                    <div className="flex flex-1 flex-col p-4">
                        <h3 className="text-sm font-semibold">{tpl.name}</h3>
                        <span
                            className="mt-1.5 inline-flex self-start items-center rounded-full px-2 py-0.5 text-xs"
                            style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
                        >
                            {tpl.category}
                        </span>
                        <p className="mt-2 text-xs leading-5 text-foreground/55">{tpl.description}</p>
                        <Button className="mt-3 self-start" size="small" onClick={() => onApply(tpl.slug)}>立即套用</Button>
                    </div>
                </article>
            ))}
        </div>
    );
}
