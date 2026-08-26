import { Button, Modal, Tag } from "antd";
import { ArrowRight, Mountain } from "lucide-react";
import { Link } from "react-router";

// 权益升级引导弹窗（spec Task 12/13/14 共用）。
// 主角模式 Pro 权益、导出 Studio 版专享等锁定入口统一用它做升级引导；
// 一期无真实订阅系统，按钮统一跳 /pricing 查看档位。
export function UpgradeModal({ open, onClose, title, feature, benefits }: {
    open: boolean;
    onClose: () => void;
    /** 弹窗标题，例如「主角模式 Pro 权益」「Studio 版专享」 */
    title: string;
    /** 被锁定的能力名，例如「主角模式」「4K 无水印导出」 */
    feature: string;
    /** 该档位解锁的权益列表 */
    benefits: string[];
}) {
    return (
        <Modal
            title={title}
            open={open}
            onCancel={onClose}
            width={520}
            footer={
                <div className="flex items-center justify-between gap-3">
                    <Button onClick={onClose}>暂不需要</Button>
                    <Link to="/pricing" target="_blank" rel="noopener noreferrer">
                        <Button type="primary" icon={<ArrowRight className="size-4" />} iconPlacement="end">查看档位与升级</Button>
                    </Link>
                </div>
            }
        >
            <div className="py-2">
                <p className="text-sm leading-6 text-foreground/70">
                    <span className="font-medium text-foreground">{feature}</span> 属于付费档位权益，升级后立即解锁：
                </p>
                <ul className="mt-3 space-y-2">
                    {benefits.map((benefit) => (
                        <li key={benefit} className="flex items-start gap-2 text-sm text-foreground/80">
                            <Mountain className="mt-0.5 size-3.5 shrink-0 text-[var(--brand)]" />
                            {benefit}
                        </li>
                    ))}
                </ul>
                <div className="mt-4 rounded-md bg-[var(--brand-soft)] px-3 py-2 text-xs text-foreground/60">
                    <Tag variant="filled" color="default" className="mr-1.5">Beta</Tag>
                    一期权益体系建设中，升级通道开放后可在定价页直接开通。
                </div>
            </div>
        </Modal>
    );
}

export default UpgradeModal;
