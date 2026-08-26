import { useEffect, useRef, useState } from "react";
import { App, Button, Empty, Tag } from "antd";
import { ArrowRight, CalendarDays, Mountain, RefreshCw } from "lucide-react";
import { Link } from "react-router";

import { PageHead } from "@/components/brand/page-head";
import { PageHeader, WorkspacePage } from "@/components/layout/workspace-page";
import { listPublicActivities, type ActivityListItem, type ActivityStatus } from "@/services/api/activities";

// 幕山攀登计划 · 活动 / 赛事列表页 `/creator/activities`（spec Task 10）
//
// 一期后端 mock：listPublicActivities 返回内置 1 条赛事。
// 二期接入真实运营数据后无需改动页面，仍按本合同渲染。
export default function CreatorActivitiesPage() {
    const { message } = App.useApp();
    const [activities, setActivities] = useState<ActivityListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const sequence = useRef(0);

    const reload = async () => {
        const current = ++sequence.current;
        setLoading(true);
        try {
            const result = await listPublicActivities({ page: 1, limit: 20 });
            if (current === sequence.current) setActivities(result.activities);
        } catch (error) {
            if (current === sequence.current) message.error(error instanceof Error ? error.message : "读取活动列表失败");
        } finally {
            if (current === sequence.current) setLoading(false);
        }
    };

    useEffect(() => {
        void reload();
    }, []);

    return (
        <WorkspacePage>
            <PageHead title="活动赛事" description="幕山攀登计划活动与赛事，参与即激活创作者资格与奖励。" canonicalUrl="https://mosliy.com/creator/activities" />
            <div className="w-full pb-6">
                <PageHeader
                    title="活动赛事"
                    description="参与幕山赛事，让每一帧作品都被看见。"
                    meta={<Tag variant="filled" color="default"><Mountain className="mr-1 inline size-3" />幕山攀登计划</Tag>}
                    actions={<Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void reload()}>刷新</Button>}
                />

                <section className="mt-6">
                    {activities.length === 0 && !loading ? (
                        <Empty description="还没有活动上架，先去投拍或邀请朋友一起开拍" />
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {activities.map((item) => (
                                <ActivityCard key={item.id} item={item} />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </WorkspacePage>
    );
}

function ActivityCard({ item }: { item: ActivityListItem }) {
    const statusTag = activityStatusTag(item.status);
    const detailHref = item.slug ? `/creator/activities/${item.slug}` : `/creator/activities/${item.id}`;
    return (
        <article className="group flex min-w-0 flex-col rounded-lg border border-border bg-[var(--workspace-surface)] p-5 transition-colors hover:border-[var(--brand)]">
            <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-md bg-[var(--brand-soft)] text-[var(--brand)]">
                    <Mountain className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        {statusTag}
                        {item.entryFeeLabel ? <Tag variant="filled" color="green">{item.entryFeeLabel}</Tag> : null}
                        {item.poolLabel ? <Tag variant="filled">{item.poolLabel}</Tag> : null}
                    </div>
                    <h2 className="mt-2 truncate text-base font-semibold text-[var(--brand)]" title={item.title}>{item.title}</h2>
                    {item.subtitle ? <p className="mt-1 line-clamp-2 text-xs text-foreground/55">{item.subtitle}</p> : null}
                </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-foreground/55">
                    <CalendarDays className="size-3.5" />
                    {formatActivityPeriod(item.startedAt, item.endedAt)}
                </span>
                <Link
                    to={detailHref}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-[var(--brand-contrast)] transition-opacity hover:opacity-90"
                >
                    立即报名
                    <ArrowRight className="size-3.5" />
                </Link>
            </div>
        </article>
    );
}

function activityStatusTag(status: ActivityStatus) {
    switch (status) {
        case "active":
            return <Tag variant="filled" color="green">进行中</Tag>;
        case "upcoming":
            return <Tag variant="filled" color="blue">即将开始</Tag>;
        case "judging":
            return <Tag variant="filled" color="gold">评审中</Tag>;
        case "closed":
        default:
            return <Tag variant="filled">已结束</Tag>;
    }
}

function formatActivityPeriod(start?: string, end?: string) {
    if (!start && !end) return "时间待定";
    const fmt = (value?: string) => (value ? new Date(value).toLocaleDateString("zh-CN") : "");
    if (start && end) return `${fmt(start)} - ${fmt(end)}`;
    return fmt(start) || fmt(end) || "时间待定";
}
