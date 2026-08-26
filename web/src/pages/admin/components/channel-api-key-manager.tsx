import { useEffect, useMemo, useState } from "react";
import { App, Button, Card, Drawer, Form, Input, InputNumber, Popconfirm, Space, Switch, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Ban, CircleDot, KeyRound, Plus, RefreshCcw, RotateCcw, Save, ShieldAlert, Trash2 } from "lucide-react";

import { ListToolbar, TableSurface } from "@/components/layout/workspace-page";
import {
    deleteChannelAPIKey,
    listChannelAPIKeys,
    resetChannelAPIKeyFailures,
    saveChannelAPIKey,
    setChannelActiveAPIKey,
    type ChannelAPIKeyRequest,
} from "@/services/api/auth";
import type { ChannelAPIKey, ModelChannel } from "@/stores/use-config-store";
import { AdminPageFrame } from "./admin-shell";

type FormValues = {
    label: string;
    apiKey?: string;
    secretKey?: string;
    enabled: boolean;
    priority: number;
    active: boolean;
};

export function ChannelAPIKeyManager({ channel, onClose, onChanged }: { channel: ModelChannel; onClose: () => void; onChanged: () => void | Promise<void> }) {
    const { message } = App.useApp();
    const [keys, setKeys] = useState<ChannelAPIKey[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState<ChannelAPIKey | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [form] = Form.useForm<FormValues>();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const reload = async () => {
        if (!channel?.id) return;
        setLoading(true);
        try {
            setKeys((await listChannelAPIKeys(channel.id)).keys);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取 API Key 列表失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void reload();
        setEditing(null);
        setEditorOpen(false);
        setPage(1);
    }, [channel.id]);

    const activeKeyId = useMemo(() => channel.activeApiKeyId || "", [channel.activeApiKeyId]);

    const startCreate = () => {
        setEditing(null);
        form.setFieldsValue({ label: "", apiKey: "", secretKey: "", enabled: true, priority: 100, active: keys.length === 0 });
        setEditorOpen(true);
    };

    const startEdit = (item: ChannelAPIKey) => {
        setEditing(item);
        form.setFieldsValue({
            label: item.label,
            apiKey: "",
            secretKey: "",
            enabled: item.enabled,
            priority: item.priority,
            active: item.id === activeKeyId,
        });
        setEditorOpen(true);
    };

    const handleSubmit = async () => {
        const values = await form.validateFields();
        setSaving(true);
        try {
            const payload: ChannelAPIKeyRequest = {
                label: values.label.trim(),
                apiKey: values.apiKey || "",
                secretKey: values.secretKey || "",
                enabled: values.enabled,
                priority: values.priority,
                active: values.active,
            };
            const result = await saveChannelAPIKey(channel.id, editing?.id || "", payload);
            setKeys((prev) => {
                const next = prev.filter((x) => x.id !== result.key.id);
                return [...next, result.key].sort((a, b) => a.priority - b.priority);
            });
            if (values.active) {
                // 同步回写渠道 activeApiKeyId 视图，让已生效角标即时渲染
                channel.activeApiKeyId = result.key.id;
            } else if (editing?.id === activeKeyId && editing?.id !== result.key.id) {
                channel.activeApiKeyId = "";
            }
            message.success(editing ? "Key 已更新" : "Key 已新增");
            setEditorOpen(false);
            await onChanged();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (item: ChannelAPIKey) => {
        try {
            await deleteChannelAPIKey(channel.id, item.id);
            setKeys((prev) => prev.filter((x) => x.id !== item.id));
            if (item.id === activeKeyId) channel.activeApiKeyId = "";
            message.success("已删除");
            await onChanged();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "删除失败");
        }
    };

    const handleSetActive = async (item: ChannelAPIKey) => {
        try {
            await setChannelActiveAPIKey(channel.id, item.id);
            channel.activeApiKeyId = item.id;
            message.success(`已将「${item.label}」设为当前生效 Key`);
            setKeys([...keys]);
            await onChanged();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "设置失败");
        }
    };

    const handleResetFailures = async (item: ChannelAPIKey) => {
        try {
            await resetChannelAPIKeyFailures(channel.id, item.id);
            setKeys((prev) => prev.map((x) => (x.id === item.id ? { ...x, failureCount: 0, lastFailedAt: undefined } : x)));
            message.success("已重置失败计数");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "重置失败");
        }
    };

    const columns: ColumnsType<ChannelAPIKey> = [
        {
            title: "标签",
            dataIndex: "label",
            width: 200,
            render: (value: string, record) => (
                <Space className="w-full justify-start">
                    <KeyRound className="text-[var(--fg-muted)]" size={16} />
                    <span className="font-medium">{value}</span>
                    {record.id === activeKeyId ? (
                        <Tag icon={<CircleDot size={12} />} color="success">
                            生效中
                        </Tag>
                    ) : null}
                    {record.enabled ? null : (
                        <Tag icon={<Ban size={12} />} color="default">
                            已停用
                        </Tag>
                    )}
                </Space>
            ),
        },
        {
            title: "Key 后缀",
            dataIndex: "apiKeySuffix",
            width: 180,
            render: (value: string, record) => (
                <code className="rounded-[6px] bg-[var(--bg-muted)] px-2 py-1 font-mono text-[12px] text-[var(--fg)]">
                    ****{value || "--"}
                </code>
            ),
        },
        {
            title: "Secret Key",
            dataIndex: "hasSecretKey",
            width: 100,
            render: (value: boolean) => (
                <span>{value ? <Tag color="blue">已配置</Tag> : <Tag color="default">未配置</Tag>}</span>
            ),
        },
        {
            title: "优先级",
            dataIndex: "priority",
            width: 100,
            sorter: (a, b) => a.priority - b.priority,
        },
        {
            title: "启用",
            dataIndex: "enabled",
            width: 80,
            render: (value: boolean) => <Switch checked={value} disabled size="small" />,
        },
        {
            title: "失败计数",
            width: 120,
            render: (_, record) => (
                <Space>
                    <span className={record.failureCount > 0 ? "text-[color:var(--error)] font-medium" : "text-[var(--fg-muted)]"}>
                        {record.failureCount}
                    </span>
                    {record.lastFailedAt ? (
                        <Tooltip title={`最近失败：${new Date(record.lastFailedAt).toLocaleString()}`}>
                            <ShieldAlert className="text-[color:var(--error)]" size={14} />
                        </Tooltip>
                    ) : null}
                </Space>
            ),
        },
        {
            title: "最近使用",
            dataIndex: "lastUsedAt",
            width: 170,
            render: (value?: string) => (value ? new Date(value).toLocaleString() : <span className="text-[var(--fg-muted)]">未使用</span>),
        },
        {
            title: "操作",
            key: "action",
            width: 360,
            fixed: "right",
            render: (_, record) => (
                <Space size={4} wrap>
                    {record.id !== activeKeyId ? (
                        <Button size="small" icon={<CircleDot size={14} />} onClick={() => handleSetActive(record)}>
                            设为生效
                        </Button>
                    ) : (
                        <Button size="small" type="primary" icon={<CircleDot size={14} />} disabled>
                            当前生效
                        </Button>
                    )}
                    {record.failureCount > 0 ? (
                        <Button size="small" icon={<RotateCcw size={14} />} onClick={() => handleResetFailures(record)}>
                            重置失败
                        </Button>
                    ) : null}
                    <Button size="small" onClick={() => startEdit(record)}>
                        编辑
                    </Button>
                    <Popconfirm title="确认删除该 API Key？" onConfirm={() => handleRemove(record)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
                        <Button size="small" danger icon={<Trash2 size={14} />}>
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Drawer
            title={
                <Space>
                    <KeyRound size={18} />
                    <span>{channel.name} · API Key 管理</span>
                </Space>
            }
            open
            onClose={onClose}
            width={1040}
            styles={{ body: { padding: 0 } }}
            classNames={{ header: "workspace-drawer-header", body: "workspace-drawer-body" }}
            extra={
                <Button icon={<RefreshCcw size={14} />} onClick={reload} loading={loading}>
                    刷新
                </Button>
            }
        >
            <AdminPageFrame title="API Key 管理" description={`${channel.name} · 多 Key 与生效 Key 切换`}>
                <div className="flex flex-col gap-4 p-5">
                    <Card className="border-none shadow-none" styles={{ body: { padding: 0 } }}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-[13px] leading-relaxed text-[var(--fg-muted)]">
                                系统渠道支持多把 API Key：按<strong className="text-[var(--fg)]">优先级</strong>升序选第一把启用，或手动标记
                                <strong className="text-[var(--fg)]">「当前生效」</strong>。只有 401/403/429
                                才会累计失败，不会自动切换，需管理员手动介入。
                            </div>
                            <Space>
                                <Button type="primary" icon={<Plus size={14} />} onClick={startCreate}>
                                    新增 Key
                                </Button>
                            </Space>
                        </div>
                        <ListToolbar className="mb-2 flex-wrap">
                            <Space size="small">
                                <Tag color="blue">共 {keys.length} 把 Key</Tag>
                                <Tag color="success">生效 Key：{keys.find((x) => x.id === activeKeyId)?.label || "自动回落单 Key"}</Tag>
                            </Space>
                        </ListToolbar>
                        <TableSurface>
                            <Table<ChannelAPIKey>
                                rowKey="id"
                                columns={columns}
                                dataSource={keys}
                                loading={loading}
                                size="middle"
                                pagination={{
                                    current: page,
                                    pageSize,
                                    total: keys.length,
                                    showSizeChanger: true,
                                    pageSizeOptions: [10, 20, 50, 100],
                                    onChange: setPage,
                                    onShowSizeChange: (_, nextPageSize) => {
                                        setPageSize(nextPageSize);
                                        setPage(1);
                                    },
                                }}
                            />
                        </TableSurface>
                    </Card>
                </div>
            </AdminPageFrame>

            <Drawer
                title={editing ? `编辑 Key · ${editing.label}` : "新增 API Key"}
                open={editorOpen}
                onClose={() => setEditorOpen(false)}
                width={520}
                destroyOnClose
                classNames={{ header: "workspace-drawer-header", body: "workspace-drawer-body" }}
                styles={{ body: { paddingTop: 16 } }}
            >
                <Form form={form} layout="vertical" disabled={saving} onFinish={() => void handleSubmit()}>
                    <Form.Item name="label" label="标签" rules={[{ required: true, message: "请填写标签" }, { max: 80, message: "最多 80 字符" }]}>
                        <Input placeholder="如：主账户 / 备用 key / 国内节点" maxLength={80} showCount />
                    </Form.Item>
                    <Form.Item
                        name="apiKey"
                        label={editing ? "API Key（留空保留原值）" : "API Key"}
                        rules={[
                            { required: !editing, message: "新建时必须填写 API Key" },
                        ]}
                    >
                        <Input.Password placeholder="sk-..." autoComplete="new-password" />
                    </Form.Item>
                    <Form.Item name="secretKey" label={editing ? "Secret Key（即梦协议需要；留空保留原值）" : "Secret Key（即梦协议需要）"}>
                        <Input.Password placeholder="部分供应商需要" autoComplete="new-password" />
                    </Form.Item>
                    <Space size={24} wrap>
                        <Form.Item name="priority" label="优先级（越小越优先）" rules={[{ required: true, message: "请填写优先级" }]} style={{ marginBottom: 0 }}>
                            <InputNumber min={0} max={100000} style={{ width: 160 }} />
                        </Form.Item>
                        <Form.Item name="enabled" label="启用" valuePropName="checked" style={{ marginBottom: 0 }}>
                            <Switch />
                        </Form.Item>
                        <Form.Item name="active" label="设为当前生效" valuePropName="checked" style={{ marginBottom: 0 }}>
                            <Switch />
                        </Form.Item>
                    </Space>
                    <div className="mt-8 flex justify-end gap-2 border-t border-[var(--border-semantic)] pt-4">
                        <Button onClick={() => setEditorOpen(false)} disabled={saving}>
                            取消
                        </Button>
                        <Button type="primary" icon={<Save size={14} />} htmlType="submit" loading={saving}>
                            保存
                        </Button>
                    </div>
                </Form>
            </Drawer>
        </Drawer>
    );
}
