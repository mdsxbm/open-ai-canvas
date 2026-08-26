import { useEffect, useState } from "react";
import { App, Button, Empty, Switch, Table, Tabs, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CheckCircle2, FileText, Image as ImageIcon, RefreshCw, ShieldAlert, Video } from "lucide-react";

import { ListToolbar, TableSurface } from "@/components/layout/workspace-page";
import { listAdminContentAudits, type ContentAuditRecord, type ContentAuditStatus, type ContentAuditType } from "@/services/api/content-audit";

// 管理后台 · 内容审核骨架（spec §4.3 / Task 17）
//
// 四 Tab：待审核文本 / 待审核图片 / 待审核视频 / 审核日志。
// 一期不接第三方内容安全服务：后端返回空列表 + 开关状态，
// 开关由环境变量 CANVAS_CONTENT_AUDIT_ENABLED 控制，默认关闭。
export default function ContentAuditPanel() {
    const { message } = App.useApp();
    const [loading, setLoading] = useState(true);
    const [enabled, setEnabled] = useState(false);
    const [pendingByType, setPendingByType] = useState<Record<ContentAuditType, ContentAuditRecord[]>>({ text: [], image: [], video: [] });
    const [reviewed, setReviewed] = useState<ContentAuditRecord[]>([]);

    const reload = async () => {
        setLoading(true);
        try {
            const result = await listAdminContentAudits({ page: 1, limit: 50 });
            setEnabled(result.enabled);
            const pending: Record<ContentAuditType, ContentAuditRecord[]> = { text: [], image: [], video: [] };
            const done: ContentAuditRecord[] = [];
            for (const record of result.records) {
                if (record.status === "pending" && record.contentType in pending) pending[record.contentType].push(record);
                else done.push(record);
            }
            setPendingByType(pending);
            setReviewed(done);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取审核队列失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void reload();
    }, []);

    const pendingTable = (type: ContentAuditType) => (
        <Table
            className="app-data-table"
            rowKey="id"
            size="middle"
            loading={loading}
            columns={auditColumns(true)}
            dataSource={pendingByType[type]}
            pagination={false}
            locale={{ emptyText: <Empty description="队列为空，一期暂不产生待审数据" /> }}
        />
    );

    return (
        <div className="space-y-8">
            <section>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-base font-semibold">内容审核</h2>
                        <p className="mt-1 text-xs text-foreground/55">文本 / 图片 / 视频生成内容合规队列；一期为骨架，接入内容安全服务后开始产生待审记录。</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Tooltip title="由环境变量 CANVAS_CONTENT_AUDIT_ENABLED 控制，默认关闭；修改后重启后端生效">
                            <span className="inline-flex items-center gap-2 text-xs text-foreground/60">
                                启用内容审核
                                <Switch size="small" checked={enabled} disabled aria-label="启用内容审核" />
                            </span>
                        </Tooltip>
                        <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void reload()}>
                            刷新
                        </Button>
                    </div>
                </div>
                <ListToolbar>
                    <span className="inline-flex items-center gap-1.5 text-xs text-foreground/45">
                        <ShieldAlert className="size-3.5" />
                        审核开关当前{enabled ? "已开启" : "已关闭"}；一期审核不接第三方服务，通过 / 驳回操作将在二期开放。
                    </span>
                </ListToolbar>
                <TableSurface>
                    <Tabs
                        defaultActiveKey="text"
                        items={[
                            { key: "text", label: "待审核文本", children: pendingTable("text") },
                            { key: "image", label: "待审核图片", children: pendingTable("image") },
                            { key: "video", label: "待审核视频", children: pendingTable("video") },
                            {
                                key: "log",
                                label: "审核日志",
                                children: (
                                    <Table
                                        className="app-data-table"
                                        rowKey="id"
                                        size="middle"
                                        loading={loading}
                                        columns={auditColumns(false)}
                                        dataSource={reviewed}
                                        pagination={false}
                                        locale={{ emptyText: <Empty description="暂无已处理记录" /> }}
                                    />
                                ),
                            },
                        ]}
                    />
                </TableSurface>
            </section>
        </div>
    );
}

function auditColumns(withActions: boolean): ColumnsType<ContentAuditRecord> {
    const columns: ColumnsType<ContentAuditRecord> = [
        {
            title: "内容",
            dataIndex: "summary",
            width: 320,
            render: (_, record) => (
                <div className="flex min-w-0 items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded bg-[var(--brand-soft)] text-[var(--brand)]">
                        {record.contentType === "text" ? <FileText className="size-3.5" /> : record.contentType === "image" ? <ImageIcon className="size-3.5" /> : <Video className="size-3.5" />}
                    </span>
                    <span className="truncate text-sm" title={record.summary || record.resourceId}>{record.summary || record.resourceId || "无摘要"}</span>
                </div>
            ),
        },
        { title: "用户", dataIndex: "userId", width: 140, ellipsis: true },
        { title: "提交时间", dataIndex: "createdAt", width: 170, render: (value: string) => new Date(value).toLocaleString("zh-CN", { hour12: false }) },
        {
            title: "状态",
            dataIndex: "status",
            width: 100,
            render: (status: ContentAuditStatus) => {
                if (status === "approved") return <Tag variant="filled" color="green">已通过</Tag>;
                if (status === "rejected") return <Tag variant="filled" color="red">已驳回</Tag>;
                return <Tag variant="filled" color="gold">待审核</Tag>;
            },
        },
    ];
    if (!withActions) {
        columns.push({
            title: "处理时间",
            dataIndex: "reviewedAt",
            width: 170,
            render: (value?: string) => (value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "--"),
        });
    } else {
        columns.push({
            title: "操作",
            width: 160,
            render: () => (
                <div className="flex gap-1.5">
                    <Button size="small" type="text" disabled icon={<CheckCircle2 className="size-3.5" />}>通过</Button>
                    <Button size="small" type="text" danger disabled>驳回</Button>
                </div>
            ),
        });
    }
    return columns;
}
