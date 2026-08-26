import { useEffect, useRef, useState } from "react";
import { App, Button, Form, Input, Modal, Tag } from "antd";
import { ArrowLeft, CalendarCheck, Coins, Mountain, Sparkles, Trophy } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageHead } from "@/components/brand/page-head";
import { PageHeader, WorkspacePage } from "@/components/layout/workspace-page";
import { getActivityDetail, submitActivityEntry, type ActivityDetail, type ActivityStageSummary, type ActivityRewardTierSummary } from "@/services/api/activities";

// 幕山攀登计划 · 活动 / 赛事详情页 `/creator/activities/:id`（spec Task 10）
//
// 一期后端 mock：getActivityDetail 返回内置赛事详情，submitActivityEntry 返回 mock 报名结果。
// spec TR-10-02 要求 5 个阶梯步骤（报名 / 征集 / 初评 / 复评 / 颁奖）+ 报名按钮 + 报名弹窗表单 ≥ 3 字段。
// spec TR-10-03 要求报名后 Toast 文案「报名成功，参赛资格已激活，奖励 500 积分 7 天有效」。

type EntryFormValues = {
    displayName: string;
    contact: string;
    track: string;
    note?: string;
};

export default function ActivityDetailPage() {
    const { id } = useParams();
    const { message } = App.useApp();
    const [detail, setDetail] = useState<ActivityDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [entryOpen, setEntryOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm<EntryFormValues>();
    const sequence = useRef(0);

    const reload = async () => {
        const current = ++sequence.current;
        if (!id) return;
        setLoading(true);
        try {
            const value = await getActivityDetail(id);
            if (current === sequence.current) setDetail(value);
        } catch (error) {
            if (current === sequence.current) message.error(error instanceof Error ? error.message : "读取活动详情失败");
        } finally {
            if (current === sequence.current) setLoading(false);
        }
    };

    useEffect(() => {
        void reload();
    }, [id]);

    const submit = async (values: EntryFormValues) => {
        if (!detail) return;
        setSubmitting(true);
        try {
            const result = await submitActivityEntry(detail.id, {
                displayName: values.displayName.trim(),
                contact: values.contact.trim(),
                track: values.track.trim(),
                note: values.note?.trim() || undefined,
            });
            setEntryOpen(false);
            form.resetFields();
            // spec TR-10-03：固定 Toast 文案。
            message.success(`报名成功，参赛资格已激活，奖励 ${result.activateCredits} 积分 ${result.activateDays} 天有效`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "报名失败");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading && !detail) {
        return (
            <WorkspacePage>
                <PageHead title="活动详情" />
                <div className="py-16 text-center text-sm text-foreground/50">正在读取活动详情...</div>
            </WorkspacePage>
        );
    }

    if (!detail) {
        return (
            <WorkspacePage>
                <PageHead title="活动不存在" />
                <PageHeader title="活动不存在或已下架" description="可能链接已失效，回到活动列表看看其他赛事。" />
                <div className="mt-6">
                    <Link to="/creator/activities" className="inline-flex items-center gap-1.5 text-sm text-[var(--brand)] hover:opacity-80">
                        <ArrowLeft className="size-4" /> 返回活动列表
                    </Link>
                </div>
            </WorkspacePage>
        );
    }

    return (
        <WorkspacePage>
            <PageHead title={detail.title} description="幕山攀登计划活动详情，包含赛制、奖励阶梯与报名入口。" />
            <div className="w-full pb-6">
                <PageHeader
                    title={detail.title}
                    description={detail.subtitle}
                    meta={<Tag variant="filled" color="default"><Mountain className="mr-1 inline size-3" />幕山攀登计划</Tag>}
                    actions={
                        <Link to="/creator/activities" className="inline-flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground">
                            <ArrowLeft className="size-4" /> 返回列表
                        </Link>
                    }
                />

                {/* Banner 区：奖池高亮 */}
                <section className="mt-6 overflow-hidden rounded-lg border border-border bg-[var(--brand)] text-[var(--brand-contrast)]">
                    <div className="grid gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-8">
                        <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Tag variant="filled" color="green">进行中</Tag>
                                {detail.entryFeeLabel ? <Tag variant="filled">{detail.entryFeeLabel}</Tag> : null}
                            </div>
                            <h2 className="text-xl font-semibold leading-tight sm:text-2xl">{detail.title}</h2>
                            {detail.subtitle ? <p className="text-sm opacity-75">{detail.subtitle}</p> : null}
                            <div className="flex flex-wrap items-center gap-4 text-xs opacity-70">
                                <span className="inline-flex items-center gap-1.5">
                                    <CalendarCheck className="size-3.5" /> 报名截止 {detail.signupEndAt ? formatTime(detail.signupEndAt) : "待定"}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <CalendarCheck className="size-3.5" /> {formatActivityPeriod(detail.startedAt, detail.endedAt)}
                                </span>
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-xs opacity-65">总奖池</span>
                            <span className="text-3xl font-semibold leading-tight">{detail.poolLabel || "¥0"}</span>
                            <Button type="primary" size="large" className="mt-2" onClick={() => setEntryOpen(true)}>我要报名</Button>
                        </div>
                    </div>
                </section>

                {/* 赛制 5 阶梯 */}
                <section className="mt-6 rounded-lg border border-border bg-[var(--workspace-surface)] p-5">
                    <h3 className="text-base font-semibold text-[var(--brand)]">赛制介绍</h3>
                    <p className="mt-1 text-xs text-foreground/55">五个阶梯：从报名到颁奖，覆盖完整创作与评审流程。</p>
                    <ol className="mt-4 grid gap-3 sm:grid-cols-5">
                        {detail.stages.map((stage, index) => (
                            <li key={stage.kind} className="rounded-md border border-border/70 bg-background/60 p-3">
                                <div className="flex items-center gap-2">
                                    <span className="grid size-6 place-items-center rounded-sm bg-[var(--brand)] text-xs font-medium text-[var(--brand-contrast)]">{index + 1}</span>
                                    <h4 className="text-sm font-medium text-foreground">{stage.title}</h4>
                                </div>
                                <p className="mt-2 text-xs leading-5 text-foreground/55">{stage.summary || "待公布"}</p>
                                <p className="mt-2 text-[10px] text-foreground/40">{stagePeriodLabel(stage)}</p>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* 奖励阶梯 */}
                <section className="mt-4 rounded-lg border border-border bg-[var(--workspace-surface)] p-5">
                    <h3 className="text-base font-semibold text-[var(--brand)]">奖励阶梯</h3>
                    <p className="mt-1 text-xs text-foreground/55">报名即激活积分体验，爆款作品额外返积分。</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {detail.rewardTiers.map((tier) => (
                            <RewardTierCard key={tier.title} tier={tier} />
                        ))}
                    </div>
                </section>

                {/* 投稿要求 / 规则 */}
                {detail.ruleSummary ? (
                    <section className="mt-4 rounded-lg border border-border bg-[var(--workspace-surface)] p-5">
                        <h3 className="text-base font-semibold text-[var(--brand)]">投稿要求</h3>
                        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-foreground/75">{detail.ruleSummary}</p>
                    </section>
                ) : null}

                <div className="mt-6 flex justify-center">
                    <Button type="primary" size="large" onClick={() => setEntryOpen(true)}>立即报名参赛</Button>
                </div>
            </div>

            <EntryModal open={entryOpen} submitting={submitting} onCancel={() => setEntryOpen(false)} onSubmit={(values) => void submit(values)} form={form} />
        </WorkspacePage>
    );
}

function RewardTierCard({ tier }: { tier: ActivityRewardTierSummary }) {
    return (
        <div className="flex items-start gap-3 rounded-md border border-border/70 bg-background/60 p-3">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm bg-[var(--brand-soft)] text-[var(--brand)]">
                <Sparkles className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="text-sm font-medium text-foreground">{tier.title}</h4>
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--brand)]">
                        <Coins className="size-3" /> +{tier.credits}
                    </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-foreground/55">{tier.summary || "待公布"}</p>
            </div>
        </div>
    );
}

function EntryModal({ open, submitting, onCancel, onSubmit, form }: {
    open: boolean;
    submitting: boolean;
    onCancel: () => void;
    onSubmit: (values: EntryFormValues) => void;
    form: ReturnType<typeof Form.useForm<EntryFormValues>>[0];
}) {
    return (
        <Modal
            title="我要报名"
            open={open}
            onCancel={onCancel}
            footer={null}
            width={560}
        >
            <Form<EntryFormValues>
                form={form}
                layout="vertical"
                requiredMark
                onFinish={onSubmit}
                className="mt-2"
            >
                <Form.Item name="displayName" label="姓名 / 昵称" rules={[{ required: true, message: "请填写姓名或昵称" }]}>
                    <Input placeholder="例如：幕山创作者 · 小剧场导演" maxLength={64} />
                </Form.Item>
                <Form.Item name="contact" label="联系方式" rules={[{ required: true, message: "请填写联系方式" }]}>
                    <Input placeholder="手机号 / 邮箱 / 飞书账号" maxLength={128} />
                </Form.Item>
                <Form.Item name="track" label="作品赛道" rules={[{ required: true, message: "请选择作品赛道" }]}>
                    <Input placeholder="例如：都市短剧 / 古风言情 / 真人转绘" maxLength={64} />
                </Form.Item>
                <Form.Item name="note" label="报名备注（可选）">
                    <Input.TextArea placeholder="想说的话、想用幕山哪项能力、是否已有作品雏形" autoSize={{ minRows: 2, maxRows: 5 }} maxLength={500} />
                </Form.Item>
                <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-foreground/45">报名即同意幕山攀登计划规则；积分奖励 7 天内有效。</span>
                    <Button type="primary" htmlType="submit" loading={submitting} icon={<Trophy className="size-4" />}>提交报名</Button>
                </div>
            </Form>
        </Modal>
    );
}

function stagePeriodLabel(stage: ActivityStageSummary) {
    const start = stage.startAt ? formatTime(stage.startAt) : "";
    const end = stage.endAt ? formatTime(stage.endAt) : "";
    if (!start && !end) return "时间待定";
    return `${start || "—"} ~ ${end || "—"}`;
}

function formatActivityPeriod(start?: string, end?: string) {
    const fmt = (value?: string) => (value ? new Date(value).toLocaleDateString("zh-CN") : "");
    if (start && end) return `${fmt(start)} - ${fmt(end)}`;
    return fmt(start) || fmt(end) || "时间待定";
}

function formatTime(value?: string) {
    return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "--";
}
