import { useEffect, useState } from "react";
import { App, Button, Modal, Spin } from "antd";
import { BadgePercent, Coins, QrCode, ShieldCheck, Sparkles } from "lucide-react";

import { formatCredits } from "@/constant/credits";
import { listCreditPackages, simulatePurchase, type CreditPackage } from "@/services/api/wallet";

// 生成幂等订单号：安全上下文优先用 crypto.randomUUID，
// 否则用 crypto.getRandomValues 拼 8-4-4-4-12 UUIDv4 形态。
function generateOrderId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        crypto.getRandomValues(bytes);
    } else {
        // 兜底：时间戳 + Math.random，足够一期模拟支付幂等场景。
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type PayMethod = "wxpay" | "alipay";

const PAY_METHODS: Array<{ key: PayMethod; label: string }> = [
    { key: "wxpay", label: "微信支付" },
    { key: "alipay", label: "支付宝" },
];

/**
 * 充值积分包（spec §3.9.2）：6 档卡片 + 模拟支付。
 * 一期不接真实支付渠道，点支付弹出二维码占位，确认后走后端幂等入账。
 */
export function CreditPackageGrid({ onPaid }: { onPaid?: () => void }) {
    const { message } = App.useApp();
    const [packages, setPackages] = useState<CreditPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [payTarget, setPayTarget] = useState<{ pkg: CreditPackage; method: PayMethod } | null>(null);
    const [paying, setPaying] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        listCreditPackages()
            .then((result) => {
                if (!cancelled) setPackages(result.packages);
            })
            .catch((error) => {
                if (!cancelled) message.error(error instanceof Error ? error.message : "读取充值包失败");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const confirmPay = async () => {
        if (!payTarget) return;
        setPaying(true);
        try {
            // orderId 前端生成，服务端以此为幂等键，重复提交不会重复入账。
            // crypto.randomUUID 仅在安全上下文（https / localhost）可用，
            // 自建幂等键保证非安全上下文（如 http IP 访问）也能模拟支付。
            const orderId = generateOrderId();
            const result = await simulatePurchase({ packageKey: payTarget.pkg.key, method: payTarget.method, orderId });
            message.success(`模拟支付成功，${formatCredits(payTarget.pkg.creditsMicrocredits)} 积分已到账`);
            if (!result.granted) message.info("该订单此前已入账，未重复加积分");
            setPayTarget(null);
            onPaid?.();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "模拟支付失败");
        } finally {
            setPaying(false);
        }
    };

    if (loading) {
        return (
            <div className="grid min-h-40 place-items-center" data-testid="credit-package-grid-loading">
                <Spin />
            </div>
        );
    }

    return (
        <div data-testid="credit-package-grid">
            <div className="mb-3 flex flex-col gap-1">
                <h3 className="text-base font-semibold">充值积分包</h3>
                <p className="m-0 text-xs leading-5 text-foreground/55">1 元 ≈ 10 积分，充值越多赠送越多；当前为测试模式，支付仅做模拟入账验证。</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {packages.map((pkg) => (
                    <article key={pkg.key} className="wallet-package-card" data-testid="credit-package-card">
                        <header className="flex items-start justify-between gap-2">
                            <div>
                                <h4 className="text-sm font-semibold">{pkg.title}</h4>
                                <div className="mt-1.5 flex items-baseline gap-1">
                                    <span className="text-xl font-semibold tabular-nums">{pkg.priceLabel}</span>
                                    <span className="text-xs text-foreground/45">/ 次</span>
                                </div>
                            </div>
                            <Coins className="size-4 shrink-0 text-foreground/35" />
                        </header>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="wallet-package-credit tabular-nums">{formatCredits(pkg.creditsMicrocredits)} 积分</span>
                            {pkg.bonusLabel ? <span className="wallet-package-bonus"><BadgePercent className="size-3" />{pkg.bonusLabel}</span> : null}
                            {pkg.perkLabel ? <span className="wallet-package-perk"><Sparkles className="size-3" />{pkg.perkLabel}</span> : null}
                        </div>
                        <footer className="mt-4 grid grid-cols-2 gap-2">
                            {PAY_METHODS.map((method) => (
                                <Button key={method.key} size="small" onClick={() => setPayTarget({ pkg, method: method.key })}>
                                    {method.label}
                                </Button>
                            ))}
                        </footer>
                    </article>
                ))}
            </div>

            <Modal
                className="workspace-modal workspace-modal-compact"
                title={payTarget ? `${payTarget.method === "wxpay" ? "微信支付" : "支付宝"} · ${payTarget.pkg.title}` : "模拟支付"}
                open={Boolean(payTarget)}
                okText="模拟支付成功"
                cancelText="取消"
                confirmLoading={paying}
                onCancel={() => setPayTarget(null)}
                onOk={() => void confirmPay()}
                styles={{ body: { paddingTop: 12 } }}
            >
                {payTarget ? (
                    <div className="flex flex-col items-center gap-3 py-2">
                        <div className="wallet-pay-qr" aria-label="支付二维码占位">
                            <QrCode className="size-16 text-foreground/25" />
                        </div>
                        <p className="m-0 text-sm">
                            应付 <span className="font-semibold tabular-nums">{payTarget.pkg.priceLabel}</span>，到账
                            <span className="font-semibold tabular-nums"> {formatCredits(payTarget.pkg.creditsMicrocredits)} </span>
                            积分
                        </p>
                        <p className="m-0 flex items-center gap-1 text-xs text-foreground/50">
                            <ShieldCheck className="size-3.5" />
                            测试模式：一期未接入真实支付渠道，点击确认即模拟入账
                        </p>
                    </div>
                ) : null}
            </Modal>
        </div>
    );
}
