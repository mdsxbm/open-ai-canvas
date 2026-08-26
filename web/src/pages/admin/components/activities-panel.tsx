import { useEffect, useState } from "react";
import { App, Button, Empty, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CalendarDays, Mountain, Plus, RefreshCw } from "lucide-react";

import { ListToolbar, TableSurface } from "@/components/layout/workspace-page";
import { listAdminActivities, type ActivityListItem, type ActivityStatus } from "@/services/api/activities";

// 幕山攀登计划 · 活动管理后台面板（spec Task 10）
//
// 一期后端 mock：listAdminActivities 返回内置 1 条赛事。
// spec §3.4：管理后台 CRUD 骨架，一期只占位接口与列表展示，二期接入真实持久化。
export default function ActivitiesPanel() {
    const { message } = App.useApp();
    const [activities, setActivities] = useState<ActivityListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);

    const reload = async (targetPage = page, targetPageSize = pageSize) => {
        setLoading(true);
        try {
            const result = await listAdminActivities({ page: targetPage, limit: targetPageSize });
            setActivities(result.activities);
            setTotal(result.total);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取活动列表失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void reload(page, pageSize);
    }, [page, pageSize]);

    const columns: ColumnsType<ActivityListItem> = [
        {
            title: "活动",
            width: 320,
            render: (_, item) => (
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="grid size-6 place-items-center rounded-sm bg-[var(--brand-soft)] text-[var(--brand)]"><Mountain className="size-3.5" /></span>
                        <span className="truncate text-sm font-medium text-foreground" title={item.title}>{item.title}</span>
                    </div>
                    {item.subtitle ? <div className="mt-1 truncate text-xs text-foreground/45">{item.subtitle}</div> : null}
                </div>
            ),
        },
        {
            title: "状态",
            dataIndex: "status",
            width: 110,
            render: (status: ActivityStatus) => activityStatusTag(status),
        },
        { title: "报名费", dataIndex: "entryFeeLabel", width: 110, render: (value) => value || <span className="text-foreground/35">--</span> },
        { title: "奖池", dataIndex: "poolLabel", width: 150, render: (value) => value || <span className="text-foreground/35">--</span> },
        {
            title: "周期",
            width: 220,
            render: (_, item) => (
                <span className="inline-flex items-center gap-1.5 text-xs text-foreground/55">
                    <CalendarDays className="size-3.5" />
                    {formatActivityPeriod(item.startedAt, item.endedAt)}
                </span>
            ),
        },
        {
            title: "操作",
            width: 110,
            fixed: "right",
            render: () => (
                <Button size="small" type="text" disabled>
                    编辑
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-8">
            <section>
                <div className="mb-4 flex items-end justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold">活动列表</h2>
                        <p className="mt-1 text-xs text-foreground/55">幕山攀登计划活动运营；一期为 mock 实现，二期接入真实持久化后可创建 / 编辑。</p>
                    </div>
                    <div className="flex gap-2">
                        <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void reload()}>
                            刷新
                        </Button>
                        <Button type="primary" icon={<Plus className="size-4" />} disabled>
                            新建活动
                        </Button>
                    </div>
                </div>
                <ListToolbar>
                    <span className="text-xs text-foreground/45">一期仅展示内置赛事，搜索与过滤在二期接入持久化后启用。</span>
                </ListToolbar>
                <TableSurface>
                    <Table
                        className="app-data-table"
                        rowKey="id"
                        size="middle"
                        loading={loading}
                        columns={columns}
                        dataSource={activities}
                        pagination={{
                            current: page,
                            pageSize,
                            total,
                            showSizeChanger: true,
                            pageSizeOptions: [20, 50, 100],
                            showTotal: (value, range) => `${range[0]}-${range[1]} / 共 ${value} 个活动`,
                            onChange: (nextPage, nextPageSize) => {
                                setPage(nextPageSize !== pageSize ? 1 : nextPage);
                                setPageSize(nextPageSize);
                            },
                        }}
                        scroll={{ x: 980 }}
                        locale={{ emptyText: <Empty description="尚无活动，先在后台创建一场赛事吧" /> }}
                    />
                </TableSurface>
            </section>
        </div>
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
    const fmt = (value?: string) => (value ? new Date(value).toLocaleDateString("zh-CN") : "");
    if (start && end) return `${fmt(start)} - ${fmt(end)}`;
    return fmt(start) || fmt(end) || "时间待定";
}
