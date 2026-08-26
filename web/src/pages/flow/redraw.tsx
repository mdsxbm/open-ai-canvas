import { useState } from "react";
import { App, Button, Input, Switch, Tag, Upload } from "antd";
import type { UploadFile } from "antd";
import { Check, Clapperboard, Film, Lock, Scissors, Sparkles, Upload as UploadIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { PageHead } from "@/components/brand/page-head";
import { UpgradeModal } from "@/components/entitlements/upgrade-modal";
import { ComplianceCheckbox } from "@/pages/flow/compliance-checkbox";
import { createRedrawTask } from "@/services/api/task-center";

// 幕山投拍 · 真人转绘向导子流程（spec Task 12 / §3.6）
//
// 4 步向导：上传素材 → 镜头切分（一期模拟）→ 选择风格 → 主角模式 & 投拍。
// 一期约束：
//   - 镜头切分为客户端模拟（按固定时长切段），不真实调推理服务；
//   - 主角模式为 Beta，一期所有用户视为免费档，点击开关弹「主角模式 Pro 权益」升级引导（TR-12-03）；
//   - 提交走通用 /tasks 通道（type=flow_redraw），任务列表用「风格转绘」过滤器查看（TR-12-04）。

type StepKey = "upload" | "split" | "style" | "protagonist";

const STEPS: Array<{ key: StepKey; title: string; hint: string }> = [
    { key: "upload", title: "上传素材", hint: "上传一段真人实拍视频或照片序列" },
    { key: "split", title: "镜头切分", hint: "自动识别镜头边界，一期为模拟切分" },
    { key: "style", title: "选择风格", hint: "6 种风格一键套用全片" },
    { key: "protagonist", title: "主角模式", hint: "锁定主角脸部一致性（Beta）" },
];

const REDRAW_STYLES: Array<{ key: string; label: string; desc: string }> = [
    { key: "pixar", label: "迪士尼皮克斯", desc: "3D 动画质感，圆润光影，适合合家欢" },
    { key: "ghibli", label: "吉卜力", desc: "手绘水彩质感，自然光与治愈系配色" },
    { key: "korean_comic", label: "韩漫唯美", desc: "柔和滤镜与精致五官，适合言情短剧" },
    { key: "american_comic", label: "美漫英雄", desc: "硬朗线条与高对比色块，冲击力强" },
    { key: "ink_wash", label: "国风水墨", desc: "留白与墨韵，适合古装与武侠" },
    { key: "cyberpunk", label: "赛博朋克", desc: "霓虹光效与冷色金属感，适合悬疑科幻" },
];

// 模拟切分：固定 4 秒一个镜头，时长仅作展示占位。
const MOCK_SHOT_SECONDS = 4;

export default function FlowRedrawPage() {
    const navigate = useNavigate();
    const { message } = App.useApp();
    const [step, setStep] = useState<StepKey>("upload");
    const [files, setFiles] = useState<UploadFile[]>([]);
    const [shots, setShots] = useState<Array<{ id: string; index: number; start: number; duration: number }>>([]);
    const [style, setStyle] = useState<string>("");
    const [protagonistMode, setProtagonistMode] = useState(false);
    const [upgradeOpen, setUpgradeOpen] = useState(false);
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [compliant, setCompliant] = useState(false);

    const stepIndex = STEPS.findIndex((item) => item.key === step);
    const canNext = step === "upload" ? files.length > 0 : step === "split" ? shots.length > 0 : step === "style" ? Boolean(style) : true;

    // 一期没有真实订阅系统：所有用户按免费档处理，主角模式一律弹升级引导。
    // 二期接入订阅后在此读取用户 plan 替换判断。
    const hasProEntitlement = false;

    const mockSplit = () => {
        const total = Math.max(1, files.length) * 3; // 一期模拟：每个素材固定切 3 个镜头。
        const next: Array<{ id: string; index: number; start: number; duration: number }> = [];
        for (let index = 0; index < total; index++) {
            next.push({ id: `shot-${index + 1}`, index: index + 1, start: index * MOCK_SHOT_SECONDS, duration: MOCK_SHOT_SECONDS });
        }
        setShots(next);
        message.success(`已模拟切分出 ${total} 个镜头，一期切分结果仅作流程演示`);
    };

    const submit = async () => {
        if (!style) {
            message.warning("请先选择一种风格");
            return;
        }
        setSubmitting(true);
        try {
            await createRedrawTask({
                referenceIds: shots.map((shot) => shot.id),
                style,
                protagonistMode,
                note: note.trim() || undefined,
            });
            message.success("转绘任务已提交，正在排队");
            navigate("/tasks");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "提交转绘任务失败");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="app-user-content app-workspace-canvas app-workspace-scroll h-full overflow-y-auto text-foreground">
            <PageHead title="真人转绘" />
            <div className="w-full px-4 pb-12 pt-6 sm:px-6 lg:px-8">
                <section className="pb-6">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl" style={{ color: "var(--brand)" }}>真人转绘</h1>
                        <Tag variant="filled" color="default">Beta</Tag>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-foreground/58 sm:text-base">把真人实拍一键变成动画风格成片 · 4 步开拍。</p>
                    <Link to="/flow" className="mt-2 inline-block text-xs text-foreground/45 hover:text-foreground/70">← 返回幕山投拍</Link>
                </section>

                {/* 4 步进度条（TR-12-01）：当前步骤高亮，已完成步骤打勾。 */}
                <ol className="grid gap-2 sm:grid-cols-4" data-testid="redraw-steps">
                    {STEPS.map((item, index) => {
                        const done = index < stepIndex;
                        const active = index === stepIndex;
                        return (
                            <li
                                key={item.key}
                                aria-current={active ? "step" : undefined}
                                className={`rounded-lg border p-3 transition ${active ? "border-[var(--brand)] bg-[var(--brand-soft)]" : done ? "border-border bg-background" : "border-border/60 bg-background/40 opacity-70"}`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium ${active ? "bg-[var(--brand)] text-[var(--brand-contrast)]" : done ? "bg-foreground/10 text-foreground/70" : "bg-foreground/5 text-foreground/45"}`}>
                                        {done ? <Check className="size-3.5" /> : index + 1}
                                    </span>
                                    <span className={`text-sm font-medium ${active ? "text-[var(--brand)]" : "text-foreground/70"}`}>{item.title}</span>
                                </div>
                                <p className="mt-1.5 pl-8 text-xs leading-5 text-foreground/45">{item.hint}</p>
                            </li>
                        );
                    })}
                </ol>

                <section className="mt-6 rounded-lg border border-border bg-[var(--workspace-surface)] p-5">
                    {step === "upload" ? (
                        <div className="space-y-4">
                            <h2 className="text-base font-semibold">第一步 · 上传素材</h2>
                            <Upload.Dragger
                                multiple
                                accept="video/*,image/*"
                                fileList={files}
                                beforeUpload={() => false}
                                onChange={({ fileList }) => setFiles(fileList)}
                            >
                                <p className="flex flex-col items-center gap-2 py-4 text-foreground/60">
                                    <UploadIcon className="size-8" />
                                    <span className="text-sm">点击或拖拽上传真人实拍视频 / 照片</span>
                                    <span className="text-xs text-foreground/40">一期仅做流程演示，素材不会真实上传到服务器</span>
                                </p>
                            </Upload.Dragger>
                        </div>
                    ) : null}

                    {step === "split" ? (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h2 className="text-base font-semibold">第二步 · 镜头切分</h2>
                                <Button icon={<Scissors className="size-4" />} onClick={mockSplit} disabled={files.length === 0}>模拟切分</Button>
                            </div>
                            {shots.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-foreground/50">点击「模拟切分」预览镜头边界，一期切分结果仅作演示</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    {shots.map((shot) => (
                                        <div key={shot.id} className="rounded-md border border-border/70 bg-background/60 p-3 text-center">
                                            <Film className="mx-auto size-5 text-foreground/35" />
                                            <div className="mt-2 text-sm font-medium">镜头 {shot.index}</div>
                                            <div className="mt-1 text-xs tabular-nums text-foreground/45">{shot.start}s – {shot.start + shot.duration}s</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : null}

                    {step === "style" ? (
                        <div className="space-y-4">
                            <h2 className="text-base font-semibold">第三步 · 选择风格</h2>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {REDRAW_STYLES.map((item) => {
                                    const selected = style === item.key;
                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => setStyle(item.key)}
                                            aria-pressed={selected}
                                            className={`rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 ${selected ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-border bg-background hover:border-foreground/20"}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`text-sm font-semibold ${selected ? "text-[var(--brand)]" : "text-foreground"}`}>{item.label}</span>
                                                {selected ? <Check className="size-4 text-[var(--brand)]" /> : null}
                                            </div>
                                            <p className="mt-1.5 text-xs leading-5 text-foreground/55">{item.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}

                    {step === "protagonist" ? (
                        <div className="space-y-5">
                            <h2 className="text-base font-semibold">第四步 · 主角模式（Beta）</h2>
                            <div className="flex items-start justify-between gap-4 rounded-lg border border-border/70 bg-background/60 p-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">锁定主角一致性</span>
                                        <Tag variant="filled" color="default">Beta</Tag>
                                        {!hasProEntitlement ? <Tag variant="filled" color="gold"><Lock className="mr-1 inline size-3" />Pro</Tag> : null}
                                    </div>
                                    <p className="mt-1.5 text-xs leading-5 text-foreground/55">转绘全程保持主角脸部与体态一致，避免风格化后「换人」。一期为 Pro 权益，免费档暂不可用。</p>
                                </div>
                                <Switch
                                    checked={protagonistMode}
                                    onChange={(next) => {
                                        if (next && !hasProEntitlement) {
                                            // TR-12-03：免费用户点击开关 → 弹出升级引导，开关保持关闭。
                                            setUpgradeOpen(true);
                                            return;
                                        }
                                        setProtagonistMode(next);
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-foreground/62">创作说明（可选）</label>
                                <Input.TextArea
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    placeholder="补充想强调的画面氛围、色调偏好或节奏要求……"
                                    autoSize={{ minRows: 3, maxRows: 6 }}
                                    maxLength={500}
                                />
                            </div>
                        </div>
                    ) : null}

                    <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                        <Button disabled={stepIndex === 0} onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)].key)}>上一步</Button>
                        <div className="flex flex-col items-end gap-2">
                            {step === "protagonist" ? (
                                <Button type="primary" size="large" loading={submitting} icon={<Clapperboard className="size-4" />} onClick={() => void submit()} disabled={!style || !compliant}>立即投拍</Button>
                            ) : (
                                <Button type="primary" disabled={!canNext} onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)].key)}>下一步</Button>
                            )}
                            {step === "protagonist" ? <ComplianceCheckbox checked={compliant} onChange={setCompliant} /> : null}
                        </div>
                    </footer>
                </section>

                <p className="mt-4 flex items-center gap-1.5 text-xs text-foreground/40">
                    <Sparkles className="size-3.5" />
                    一期为流程骨架：镜头切分与素材上传均为演示占位，提交后任务在「任务中心 · 风格转绘」筛选下可见。
                </p>
            </div>

            <UpgradeModal
                open={upgradeOpen}
                onClose={() => setUpgradeOpen(false)}
                title="主角模式 Pro 权益"
                feature="主角模式"
                benefits={["转绘全程锁定主角脸部与体态一致性", "支持多主角设定与镜头级切换", "角色健康度体检与补图建议"]}
            />
        </main>
    );
}
