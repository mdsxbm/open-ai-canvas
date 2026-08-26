import { Modal, Button } from "antd";

import type { ShowcaseWork } from "@/stages/mock-showcase";

/**
 * 幕山首映 · 创作过程弹窗（spec Task 08）
 *
 * 展示某条 Showcase 作品的 5 段创作时间线（剧本/角色/分镜/精渲/合成），
 * 底部提供 CTA 按钮，引导跳转投拍向导。
 *
 * 视觉：左侧竖线 + 圆点的时间线，颜色统一走 CSS var，黑白极简。
 * 验收映射：AC-FL-02、TR-08-02
 */

interface ShowcaseProcessModalProps {
    open: boolean;
    work: ShowcaseWork | null;
    onClose: () => void;
    onUseTemplate?: (work: ShowcaseWork) => void;
}

export function ShowcaseProcessModal({ open, work, onClose, onUseTemplate }: ShowcaseProcessModalProps) {
    const steps = work?.process ?? [];

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title={work ? `${work.title} · 创作过程` : "创作过程"}
            footer={
                work ? (
                    <Button
                        type="primary"
                        onClick={() => {
                            onUseTemplate?.(work);
                            onClose();
                        }}
                    >
                        🎬 用此模板投拍
                    </Button>
                ) : null
            }
            destroyOnClose
            width={560}
        >
            {work ? (
                <div className="showcase-process">
                    {/* 作品概要：分类 / 时长 / 作者 */}
                    <p className="text-[var(--fs-caption)] text-[var(--brand)] opacity-65">
                        {work.category} · 成片 {work.duration} · 作者 {work.author}
                    </p>

                    {/* 5 段时间线：每段独立 border-l + before 圆点，拼接成连续竖线 */}
                    <ol className="mt-5">
                        {steps.map((step, index) => {
                            const isLast = index === steps.length - 1;
                            return (
                                <li
                                    key={`${step.stage}-${index}`}
                                    className={`relative border-l border-[var(--workspace-border)] pl-6 before:absolute before:left-0 before:top-1.5 before:grid before:size-2 before:-translate-x-1/2 before:place-items-center before:rounded-full before:bg-[var(--brand)] before:content-[''] ${
                                        isLast ? "pb-0" : "pb-6"
                                    }`}
                                >
                                    <p className="text-[var(--fs-caption)] font-medium uppercase tracking-wider text-[var(--brand)] opacity-75">
                                        {step.stage}
                                    </p>
                                    <p className="mt-1 text-[var(--fs-body)] font-medium text-[var(--brand)]">
                                        {step.title}
                                    </p>
                                    <p className="mt-1 text-[var(--fs-caption)] text-[var(--brand)] opacity-65">
                                        用时 {step.duration}
                                    </p>
                                    {step.note ? (
                                        <p className="mt-1 text-[var(--fs-caption)] text-[var(--brand)] opacity-55">
                                            {step.note}
                                        </p>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ol>
                </div>
            ) : null}
        </Modal>
    );
}

export default ShowcaseProcessModal;
