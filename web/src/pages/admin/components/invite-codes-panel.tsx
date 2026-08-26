import { useEffect, useState } from "react";
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Ban, Copy, Eye, Gift, Mountain, RefreshCw, Search, TicketCheck } from "lucide-react";

import { ListToolbar, TableSurface } from "@/components/layout/workspace-page";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { AdminExportButton } from "./admin-ui";
import { createAdminInviteBatch, listAdminInviteBatches, type InviteBatch } from "@/services/api/invite";

// 幕山攀登计划 · 管理后台邀请码批次面板（spec Task 09）
//
// 一期后端 mock：listAdminInviteBatches 返回空列表，createAdminInviteBatch 返回
// 基于递增种子生成的明文邀请码但不入库。前端按真实接口契约调用即可，二期接入真实持久化后无需改动。
type InviteFormValues = { count: number; quotaPerCode: number; note?: string; expiresAt?: string };

export default function InviteCodesPanel() {
    const { message } = App.useApp();
    const [batches, setBatches] = useState<InviteBatch[]>([]);
    const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [keyword, setKeyword] = useState("");
    const debouncedKeyword = useDebouncedValue(keyword);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [form] = Form.useForm<InviteFormValues>();

    const reload = async (targetPage = page, targetPageSize = pageSize) => {
        setLoading(true);
        try {
            const result = await listAdminInviteBatches({ keyword: debouncedKeyword || undefined, page: targetPage, limit: targetPageSize });
            setBatches(result.batches);
            setTotal(result.total);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取邀请码批次失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        form.setFieldsValue({ count: 10, quotaPerCode: 1 });
    }, [form]);

    useEffect(() => {
        void reload(page, pageSize);
    }, [debouncedKeyword, page, pageSize]);

    const createBatch = async () => {
        const values = await form.validateFields();
        setCreating(true);
        try {
            const result = await createAdminInviteBatch({
                count: values.count,
                quotaPerCode: values.quotaPerCode,
                note: values.note?.trim(),
                expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : undefined,
            });
            setGeneratedCodes(result.codes);
            // 一期 mock：将新批次插入列表首行；二期接真实列表接口后由 reload 替换。
            setBatches((current) => [result.batch, ...current].slice(0, pageSize));
            setTotal((current) => current + 1);
            setPage(1);
            message.success(`已生成 ${result.codes.length} 个邀请码`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "生成邀请码失败");
        } finally {
            setCreating(false);
        }
    };

    const columns: ColumnsType<InviteBatch> = [
        { title: "创建时间", dataIndex: "createdAt", width: 180, render: formatTime },
        { title: "单码配额", dataIndex: "quotaPerCode", width: 110, align: "right", render: (value) => <span className="tabular-nums">{value}</span> },
        { title: "数量", dataIndex: "count", width: 100, align: "right", render: (value) => <span className="tabular-nums">{value}</span> },
        {
            title: "核销状态",
            width: 180,
            render: (_, batch) => (
                <div className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">{batch.consumedCount ?? 0}/{batch.count}</span>
                    <span className="text-xs text-foreground/45">已核销</span>
                    {batch.availableCount > 0 ? <Tag variant="filled" color="green">{batch.availableCount} 可用</Tag> : null}
                    {batch.disabledCount > 0 ? <Tag variant="filled">{batch.disabledCount} 已禁用</Tag> : null}
                </div>
            ),
        },
        { title: "有效期", dataIndex: "expiresAt", width: 180, render: (value) => (value ? formatTime(value) : <Tag variant="filled">永久有效</Tag>) },
        { title: "批次备注", dataIndex: "note", render: (value) => value || <span className="text-foreground/35">未填写</span> },
        {
            title: "操作",
            width: 110,
            fixed: "right",
            render: () => (
                <Space size={6}>
                    <Button size="small" type="text" icon={<Eye className="size-3.5" />} disabled>
                        明细
                    </Button>
                    <Popconfirm title="一期不支持真实禁用批次" description="二期接入真实持久化后再启用该操作。" okText="知道了" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => Promise.resolve()}>
                        <Button size="small" danger icon={<Ban className="size-3.5" />} disabled>
                            禁用
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="space-y-8">
            <section className="overflow-hidden rounded-lg border border-border bg-background">
                <div className="flex items-start gap-3 border-b border-border px-5 py-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted/40 text-[var(--brand)]">
                        <Mountain className="size-4" />
                    </span>
                    <div>
                        <h2 className="text-base font-semibold">生成邀请码批次</h2>
                        <p className="mt-1 text-xs leading-5 text-foreground/55">幕山攀登计划邀请码用于发放给种子用户；一期为 mock 实现，生成结果不入库，仅用于打通流程。</p>
                    </div>
                </div>
                <Form form={form} layout="vertical" requiredMark={false} className="grid gap-x-4 px-5 pt-5 md:grid-cols-12">
                    <Form.Item name="count" label="生成数量" rules={[{ required: true, message: "请填写生成数量" }]} className="md:col-span-2">
                        <InputNumber style={{ width: "100%" }} min={1} max={5000} precision={0} />
                    </Form.Item>
                    <Form.Item name="quotaPerCode" label="单码可邀请人数" rules={[{ required: true, message: "请填写单码配额" }]} className="md:col-span-2">
                        <InputNumber style={{ width: "100%" }} min={1} max={50} precision={0} />
                    </Form.Item>
                    <Form.Item name="expiresAt" label="过期时间" className="md:col-span-3">
                        <Input type="datetime-local" />
                    </Form.Item>
                    <Form.Item name="note" label="批次备注" className="md:col-span-5">
                        <Input maxLength={500} placeholder="例如：第一批种子用户邀请码" />
                    </Form.Item>
                    <div className="flex items-center justify-between gap-4 border-t border-border py-4 md:col-span-12">
                        <span className="text-xs text-foreground/45">单批最多生成 5,000 个；一期 mock 实现不真实入库，二期接入持久化后再启用禁用与明细。</span>
                        <Button type="primary" loading={creating} icon={<TicketCheck className="size-4" />} onClick={() => void createBatch()}>
                            生成邀请码
                        </Button>
                    </div>
                </Form>
            </section>

            <section>
                <div className="mb-4 flex items-end justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold">批次记录</h2>
                        <p className="mt-1 text-xs text-foreground/55">查看每个邀请码批次的核销状态。一期返回空列表，二期接入真实持久化后展示完整批次。</p>
                    </div>
                    <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void reload()}>
                        刷新
                    </Button>
                </div>
                <ListToolbar
                    active={Boolean(keyword)}
                    onReset={() => {
                        setKeyword("");
                        setPage(1);
                    }}
                >
                    <Input
                        allowClear
                        className="app-list-search"
                        prefix={<Search className="size-4 text-foreground/40" />}
                        value={keyword}
                        placeholder="搜索批次备注或数量"
                        onChange={(event) => {
                            setKeyword(event.target.value);
                            setPage(1);
                        }}
                    />
                </ListToolbar>
                <TableSurface>
                    <Table
                        className="app-data-table"
                        rowKey="id"
                        size="middle"
                        loading={loading}
                        columns={columns}
                        dataSource={batches}
                        pagination={{
                            current: page,
                            pageSize,
                            total,
                            showSizeChanger: true,
                            pageSizeOptions: [20, 50, 100],
                            showTotal: (value, range) => `${range[0]}-${range[1]} / 共 ${value} 个批次`,
                            onChange: (nextPage, nextPageSize) => {
                                setPage(nextPageSize !== pageSize ? 1 : nextPage);
                                setPageSize(nextPageSize);
                            },
                        }}
                        scroll={{ x: 1080 }}
                        locale={{ emptyText: "尚无批次记录，先生成一批邀请码发放给种子用户吧" }}
                    />
                </TableSurface>
            </section>

            <GeneratedCodesModal codes={generatedCodes} onClose={() => setGeneratedCodes([])} />
        </div>
    );
}

function GeneratedCodesModal({ codes, onClose }: { codes: string[]; onClose: () => void }) {
    const { message } = App.useApp();
    const content = codes.join("\n");
    const copy = async () => {
        await navigator.clipboard.writeText(content);
        message.success("邀请码已复制");
    };
    return (
        <Modal
            title={`已生成 ${codes.length} 个邀请码`}
            open={codes.length > 0}
            onCancel={onClose}
            footer={
                <Space>
                    <Button icon={<Copy className="size-4" />} onClick={() => void copy()}>
                        复制全部
                    </Button>
                    <AdminExportButton type="primary" exportFile={() => new Blob([content + "\n"], { type: "text/plain;charset=utf-8" })} fileName={() => `邀请码-${new Date().toISOString().slice(0, 10)}.txt`} label="下载 TXT" />
                </Space>
            }
            width={680}
        >
            <div className="mb-3 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                一期 mock 实现不真实入库；二期接入持久化后可在此处查看批次明细与核销记录。请立即下载留存用于发放。
            </div>
            <Input.TextArea value={content} readOnly autoSize={{ minRows: 10, maxRows: 18 }} className="font-mono text-xs" />
            <div className="mt-2 flex items-center gap-1.5 text-xs text-foreground/45">
                <Gift className="size-3.5" /> 生成即视为发放，请妥善保管。
            </div>
        </Modal>
    );
}

function formatTime(value?: string) {
    return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "--";
}
