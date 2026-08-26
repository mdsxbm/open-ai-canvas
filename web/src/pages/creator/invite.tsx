import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { App, Button, Empty, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Copy, Download, Gift, Mountain, RefreshCw, Share2, Sparkles, UserPlus, Wallet } from "lucide-react";

import { PageHead } from "@/components/brand/page-head";
import { PageHeader, WorkspacePage } from "@/components/layout/workspace-page";
import { getCreatorInviteSummary, type InviteRefereeSummary, type UserInviteSummary } from "@/services/api/invite";

// 幕山攀登计划 · 邀请好友页（spec §3.3 / Task 09）
//
// 一期后端 mock：getCreatorInviteSummary 返回基于用户 ID 派生的邀请码与默认 2 个配额，
// 不真入库；二期接入真实邀请码表后再替换。前端按真实接口契约调用即可。
// 二维码一期用 SVG 自绘伪 QR 图案（spec §6.2 一期不引入额外 npm 包），二期可接 qrcode。

export default function CreatorInvitePage() {
    const { message } = App.useApp();
    const [summary, setSummary] = useState<UserInviteSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const sequence = useRef(0);

    const reload = async () => {
        const current = ++sequence.current;
        setLoading(true);
        try {
            const value = await getCreatorInviteSummary();
            if (current === sequence.current) setSummary(value);
        } catch (error) {
            if (current === sequence.current) message.error(error instanceof Error ? error.message : "读取邀请信息失败");
        } finally {
            if (current === sequence.current) setLoading(false);
        }
    };

    useEffect(() => {
        void reload();
    }, []);

    const inviteUrl = summary?.inviteUrl || "https://mosliy.com/?invite=";
    const inviteCode = summary?.inviteCode || "";
    const remaining = Math.max(0, (summary?.quotaTotal ?? 0) - (summary?.quotaUsed ?? 0));

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(inviteUrl);
            message.success("邀请链接已复制，发送给朋友即可一起开拍");
        } catch {
            message.error("复制失败，请手动选择链接复制");
        }
    };

    const copyCode = async () => {
        if (!inviteCode) return;
        try {
            await navigator.clipboard.writeText(inviteCode);
            message.success("邀请码已复制");
        } catch {
            message.error("复制失败，请手动选择邀请码复制");
        }
    };

    const downloadQR = () => {
        const svg = document.getElementById("invite-qr") as SVGSVGElement | null;
        if (!svg) {
            message.error("二维码暂不可用");
            return;
        }
        const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `moshine-invite-${inviteCode || "code"}.svg`;
        a.click();
        URL.revokeObjectURL(url);
        message.success("二维码已下载，可贴到海报或社群分享");
    };

    return (
        <WorkspacePage>
            <PageHead title="邀请好友 · 赚积分" description="幕山攀登计划邀请好友注册与充值返积分，详情以控制台为准。" ogImage="https://mosliy.com/og/invite.svg" canonicalUrl="https://mosliy.com/creator/invite" />
            <div className="w-full pb-6">
                <PageHeader
                    title="邀请好友 · 赚积分"
                    description="幕山攀登计划：每邀请一位朋友开拍，山岭就多一座；朋友注册、首充，你都拿积分。"
                    meta={<Tag variant="filled" color="default"><Mountain className="mr-1 inline size-3" />幕山攀登计划</Tag>}
                    actions={<Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void reload()}>刷新</Button>}
                />

                <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                    <InviteLinkCard
                        inviteUrl={inviteUrl}
                        inviteCode={inviteCode}
                        remaining={remaining}
                        total={summary?.quotaTotal ?? 0}
                        used={summary?.quotaUsed ?? 0}
                        onCopyLink={() => void copyLink()}
                        onCopyCode={() => void copyCode()}
                        onDownloadQR={() => downloadQR()}
                    />
                    <RewardRulesCard />
                </div>

                <RefereeListCard referees={summary?.referees ?? []} loading={loading} />
            </div>
        </WorkspacePage>
    );
}

function InviteLinkCard({ inviteUrl, inviteCode, remaining, total, used, onCopyLink, onCopyCode, onDownloadQR }: {
    inviteUrl: string;
    inviteCode: string;
    remaining: number;
    total: number;
    used: number;
    onCopyLink: () => void;
    onCopyCode: () => void;
    onDownloadQR: () => void;
}) {
    return (
        <section className="rounded-lg border border-border bg-[var(--workspace-surface)] p-5">
            <header className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-md bg-[var(--brand-soft)] text-[var(--brand)]"><Share2 className="size-4" /></span>
                <div>
                    <h2 className="text-base font-semibold text-[var(--brand)]">你的专属邀请链接</h2>
                    <p className="mt-0.5 text-xs text-foreground/55">朋友通过链接注册即视为你的邀请；二期可在此处查看每条邀请码独立配额。</p>
                </div>
            </header>

            <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0 space-y-2.5">
                    <label className="block text-xs font-medium text-foreground/62">邀请链接</label>
                    <div className="flex items-stretch gap-2">
                        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground/80">{inviteUrl}</code>
                        {/* TR-09-01 要求 <a data-testid="copy-invite-link">：用 anchor 渲染主操作，保留 Button 视觉。 */}
                        <a
                            href={inviteUrl}
                            onClick={(event) => {
                                event.preventDefault();
                                onCopyLink();
                            }}
                            data-testid="copy-invite-link"
                            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 py-2 text-sm font-medium text-[var(--brand-contrast)] transition-opacity hover:opacity-90"
                        >
                            <Copy className="size-4" />
                            复制链接
                        </a>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-foreground/55">邀请码：</label>
                        <code className="rounded-sm bg-[var(--brand-soft)] px-1.5 py-0.5 font-mono text-xs text-[var(--brand)]">{inviteCode || "--"}</code>
                        <Button type="text" size="small" icon={<Copy className="size-3.5" />} onClick={onCopyCode} disabled={!inviteCode}>复制码</Button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-foreground/55">
                        <span>本月配额：<span className="font-medium tabular-nums text-foreground/80">{used}/{total}</span></span>
                        <span>·</span>
                        <span>剩余 <span className="font-medium tabular-nums text-foreground/80">{remaining}</span> 个</span>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <div className="grid size-[148px] place-items-center rounded-md border border-border bg-background p-2">
                        <InviteQRPlaceholder value={inviteUrl} />
                    </div>
                    <Button size="small" icon={<Download className="size-3.5" />} onClick={onDownloadQR}>保存二维码</Button>
                </div>
            </div>
        </section>
    );
}

function RewardRulesCard() {
    // 奖励规则按 spec §3.3 静态展示；二期接 ReferralReward 真实记录后可叠加领取状态。
    const rules: Array<{ icon: ReactNode; title: string; desc: string; reward: string }> = [
        { icon: <UserPlus className="size-4" />, title: "好友注册", desc: "好友通过你的邀请链接完成注册，奖励一次性发放。", reward: "你 +100 积分 · 好友 +200 积分" },
        { icon: <Wallet className="size-4" />, title: "好友首次充值", desc: "好友首次充值 ≥ 50 元，按充值金额返等值积分，永久生效一次。", reward: "返充值金额的 20% 等值积分" },
        { icon: <Sparkles className="size-4" />, title: "Pro 会员加成", desc: "Pro 会员每月可生成 10 个邀请码；免费用户 2 个；Studio 50 个。", reward: "Pro 月 10 个 · Studio 50 个" },
    ];
    return (
        <section className="rounded-lg border border-border bg-[var(--workspace-surface)] p-5">
            <header className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-md bg-[var(--brand-soft)] text-[var(--brand)]"><Gift className="size-4" /></span>
                <div>
                    <h2 className="text-base font-semibold text-[var(--brand)]">奖励规则</h2>
                    <p className="mt-0.5 text-xs text-foreground/55">实际到账以二期真实发奖记录为准；积分有效期与扣减规则见《用户协议》。</p>
                </div>
            </header>
            <ul className="mt-4 space-y-3">
                {rules.map((rule) => (
                    <li key={rule.title} className="rounded-md border border-border/70 bg-background/60 p-3">
                        <div className="flex items-start gap-3">
                            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm bg-[var(--brand-soft)] text-[var(--brand)]">{rule.icon}</span>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <h3 className="text-sm font-medium text-foreground">{rule.title}</h3>
                                    <span className="rounded-sm bg-[var(--brand)] px-1.5 py-0.5 text-xs text-[var(--brand-contrast)]">{rule.reward}</span>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-foreground/55">{rule.desc}</p>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function RefereeListCard({ referees, loading }: { referees: InviteRefereeSummary[]; loading: boolean }) {
    const columns: ColumnsType<InviteRefereeSummary> = [
        {
            title: "好友",
            width: 220,
            render: (_, item) => (
                <div className="flex items-center gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">{item.displayName?.[0] || item.username?.[0] || "幕"}</span>
                    <div className="min-w-0">
                        <div className="truncate text-sm">{item.displayName || item.username || "幕山创作者"}</div>
                        <div className="truncate text-xs text-foreground/45">{item.username ? `@${item.username}` : "未填写用户名"}</div>
                    </div>
                </div>
            ),
        },
        { title: "注册时间", dataIndex: "registeredAt", width: 180, render: formatTime },
        {
            title: "是否首充",
            dataIndex: "charged",
            width: 110,
            render: (value) => (value ? <Tag variant="filled" color="green">已首充</Tag> : <Tag variant="filled">未首充</Tag>),
        },
        {
            title: "为你带来",
            dataIndex: "rewardCredits",
            width: 130,
            align: "right",
            render: (value) => <span className="tabular-nums text-foreground/80">{value > 0 ? `+${value}` : "--"}</span>,
        },
        {
            title: "状态",
            dataIndex: "status",
            render: (value) => <Tag variant="filled">{refereeStatusLabel(value)}</Tag>,
        },
    ];
    return (
        <section className="mt-6 rounded-lg border border-border bg-[var(--workspace-surface)] p-5">
            <header className="mb-3 flex items-end justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold text-[var(--brand)]">已邀请好友</h2>
                    <p className="mt-0.5 text-xs text-foreground/55">展示通过你邀请链接注册的好友；首充返积分会在此处显示。</p>
                </div>
            </header>
            <Table
                className="app-data-table"
                rowKey="userId"
                size="middle"
                loading={loading}
                columns={columns}
                dataSource={referees}
                pagination={false}
                locale={{ emptyText: <Empty description="山脚已就位，邀请第一位朋友一起开拍吧" /> }}
            />
        </section>
    );
}

// 二维码一期 SVG 自绘伪 QR 图案（spec §6.2：不引入额外 npm 包）。
// 用确定性 hash 生成网格图案，不可扫描，仅供视觉占位与下载。
function InviteQRPlaceholder({ value }: { value: string }) {
    const cells = useMemo(() => generatePseudoQRMatrix(value, 21), [value]);
    const size = 21;
    const cell = 5;
    const finder = (offset: number) => (
        <>
            <rect x={offset * cell} y={offset * cell} width={cell * 7} height={cell * 7} fill="var(--brand)" />
            <rect x={(offset + 1) * cell} y={(offset + 1) * cell} width={cell * 5} height={cell * 5} fill="var(--brand-contrast)" />
            <rect x={(offset + 2) * cell} y={(offset + 2) * cell} width={cell * 3} height={cell * 3} fill="var(--brand)" />
        </>
    );
    return (
        <svg id="invite-qr" width={size * cell} height={size * cell} viewBox={`0 0 ${size * cell} ${size * cell}`} role="img" aria-label="邀请链接二维码占位">
            <rect width={size * cell} height={size * cell} fill="var(--brand-contrast)" />
            {cells.map((row, y) =>
                row.map((on, x) => {
                    // 跳过三个定位角区域（finder 占 7×7）。
                    const inFinder = (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
                    if (inFinder || !on) return null;
                    return <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="var(--brand)" />;
                }),
            )}
            {finder(0)}
            {finder(size - 7)}
            {/* 右下 finder：与左上、右上保持一致结构，二期替换为对齐图案。 */}
            <rect x={(size - 7) * cell} y={(size - 7) * cell} width={cell * 7} height={cell * 7} fill="var(--brand)" />
            <rect x={(size - 6) * cell} y={(size - 6) * cell} width={cell * 5} height={cell * 5} fill="var(--brand-contrast)" />
            <rect x={(size - 5) * cell} y={(size - 5) * cell} width={cell * 3} height={cell * 3} fill="var(--brand)" />
        </svg>
    );
}

// 用 FNV-1a hash 派生伪随机网格，保证同一邀请链接渲染稳定。
function generatePseudoQRMatrix(value: string, size: number): boolean[][] {
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    const rand = () => {
        hash ^= hash << 13;
        hash ^= hash >>> 17;
        hash ^= hash << 5;
        hash = hash >>> 0;
        return (hash & 0xffff) / 0xffff;
    };
    const matrix: boolean[][] = [];
    for (let y = 0; y < size; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < size; x++) {
            row.push(rand() > 0.55);
        }
        matrix.push(row);
    }
    return matrix;
}

function refereeStatusLabel(status: string) {
    switch (status) {
        case "active":
            return "活跃";
        case "charged":
            return "已首充";
        case "lapsed":
            return "未活跃";
        default:
            return status || "未知";
    }
}

function formatTime(value?: string) {
    return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "--";
}
