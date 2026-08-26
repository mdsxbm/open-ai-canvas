import { App, Button, Form, Input, Modal, Select } from "antd";

interface ContactBizModalProps {
    open: boolean;
    onClose: () => void;
    /** 默认收件人邮箱，企业版传 contact@mosliy.com */
    defaultEmail?: string;
    /** 卡片标题，用于弹窗副文案 */
    planTitle?: string;
}

interface ContactBizFormValues {
    name: string;
    company: string;
    phone: string;
    email: string;
    scale?: string;
    description?: string;
}

const SCALE_OPTIONS = [
    { label: "1-10 人", value: "1-10" },
    { label: "11-50 人", value: "11-50" },
    { label: "51-200 人", value: "51-200" },
    { label: "200 人以上", value: "200+" },
];

/**
 * 联系商务弹窗（spec Task 15）
 *
 * 一期空实现：提交按钮仅做前端 toast 提示并关闭，不调后端 API。
 * 顶部展示「联系商务 · {planTitle}」与收件人邮箱，便于用户确认渠道。
 */
export function ContactBizModal({ open, onClose, defaultEmail = "contact@mosliy.com", planTitle }: ContactBizModalProps) {
    const { message } = App.useApp();
    const [form] = Form.useForm<ContactBizFormValues>();
    const title = planTitle ? `联系商务 · ${planTitle}` : "联系商务";

    const handleSubmit = () => {
        message.success("已收到你的需求，2 个工作日内联系");
        form.resetFields();
        onClose();
    };

    const handleClose = () => {
        form.resetFields();
        onClose();
    };

    return (
        <Modal
            open={open}
            title={
                <div className="flex flex-col gap-1">
                    <span className="text-[var(--fs-title)] font-semibold text-[var(--brand)]">{title}</span>
                    <span className="text-[var(--fs-caption)] font-normal text-[var(--brand)] opacity-65">
                        收件人：{defaultEmail}
                    </span>
                </div>
            }
            onCancel={handleClose}
            footer={null}
            destroyOnClose
            mask={{ closable: false }}
            width={480}
        >
            <Form<ContactBizFormValues>
                form={form}
                layout="vertical"
                requiredMark="optional"
                onFinish={handleSubmit}
                className="mt-3"
            >
                <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
                    <Input placeholder="请输入姓名" autoComplete="name" />
                </Form.Item>
                <Form.Item name="company" label="公司" rules={[{ required: true, message: "请输入公司名称" }]}>
                    <Input placeholder="请输入公司名称" autoComplete="organization" />
                </Form.Item>
                <Form.Item name="phone" label="手机号" rules={[{ required: true, message: "请输入手机号" }]}>
                    <Input placeholder="请输入手机号" autoComplete="tel" inputMode="tel" maxLength={13} />
                </Form.Item>
                <Form.Item
                    name="email"
                    label="邮箱"
                    rules={[
                        { required: true, message: "请输入邮箱" },
                        { type: "email", message: "请输入正确的邮箱" },
                    ]}
                >
                    <Input placeholder="请输入邮箱" autoComplete="email" inputMode="email" />
                </Form.Item>
                <Form.Item name="scale" label="团队规模" rules={[{ required: true, message: "请选择团队规模" }]}>
                    <Select placeholder="请选择团队规模" options={SCALE_OPTIONS} />
                </Form.Item>
                <Form.Item name="description" label="需求描述">
                    <Input.TextArea
                        placeholder="请简要描述你的需求（可选）"
                        autoSize={{ minRows: 3, maxRows: 6 }}
                        maxLength={500}
                        showCount
                    />
                </Form.Item>
                <div className="flex justify-end gap-2 border-t border-[var(--workspace-border)] pt-4">
                    <Button onClick={handleClose}>取消</Button>
                    <Button type="primary" htmlType="submit">提交需求</Button>
                </div>
            </Form>
        </Modal>
    );
}

export default ContactBizModal;
