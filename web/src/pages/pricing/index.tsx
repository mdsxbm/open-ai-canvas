import { useState } from "react";
import { Button } from "antd";
import { ArrowLeft, Check } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { PageHead } from "@/components/brand/page-head";
import { MoshineLogo } from "@/components/brand/moshine-logo";
import { AppFooter } from "@/components/layout/app-footer";
import { ContactBizModal } from "@/pages/pricing/ContactBizModal";

interface PricingPlan {
    key: string;
    name: string;
    price: string;
    audience: string;
    features: string[];
    ctaLabel: string;
    ctaPrimary?: boolean;
    ctaHref?: string;
    onContact?: () => void;
    highlighted?: boolean;
}

const FAQ_ITEMS: { question: string; answer: string }[] = [
    {
        question: "积分会过期吗？",
        answer: "免费版每日积分次日重置；订阅积分在订阅期内有效；单独购买的积分包自购买之日起 1 年内有效。",
    },
    {
        question: "可以退款吗？",
        answer: "未消耗的积分在购买 7 天内可申请退款；已消耗的积分和已使用的订阅时长不支持退款。详见《用户协议》第四章。",
    },
    {
        question: "Studio 版与 Pro 版的区别？",
        answer: "Studio 版包含 Pro 版全部权益，并额外提供 5 席团队协作、共享素材库、商业授权、专属沟通群和 99% SLA 保障，适合需要多人协作的小团队。",
    },
    {
        question: "企业版支持私有部署吗？",
        answer: "支持。企业版可独立部署到你的私有云或机房，使用独立的 OSS 存储与合规审计链路，并提供 API 接入和专属客户经理。",
    },
    {
        question: "如何开发票？",
        answer: "登录后在「我的钱包 · 账单」中提交开票申请，电子发票通常在 3 个工作日内开具并发送到你登记的邮箱。",
    },
];

/**
 * 幕山公开定价页（spec Task 15）
 *
 * 未登录也可访问。四档定价卡片 + 常见问题。
 * Pro 卡片用 border-2 + brand 描边突出为推荐档位；Studio / 企业卡片点击「联系商务」弹出 ContactBizModal。
 */
export default function PricingPage() {
    const navigate = useNavigate();
    const [contactOpen, setContactOpen] = useState(false);
    const [contactPlan, setContactPlan] = useState<string | undefined>(undefined);
    const [contactEmail, setContactEmail] = useState<string | undefined>(undefined);

    const openContact = (planTitle: string, email?: string) => {
        setContactPlan(planTitle);
        setContactEmail(email);
        setContactOpen(true);
    };

    const plans: PricingPlan[] = [
        {
            key: "free",
            name: "免费版",
            price: "¥0/永久",
            audience: "试用与轻量创作",
            features: ["每日免费积分", "3 个项目", "720p 视频", "社区支持"],
            ctaLabel: "立即开始",
            ctaHref: "/register",
        },
        {
            key: "pro",
            name: "Pro 版",
            price: "¥99/月起",
            audience: "个人创作者长期产出",
            features: ["每月 1 万积分", "无限项目", "1080p 视频", "主角模式", "优先队列", "邮箱支持"],
            ctaLabel: "登录查看详细权益",
            ctaPrimary: true,
            ctaHref: "/login?next=/wallet",
            highlighted: true,
        },
        {
            key: "studio",
            name: "Studio 版",
            price: "¥499/月起",
            audience: "小团队协作",
            features: ["Pro 全部权益", "团队 5 席", "共享素材库", "商业授权", "专属群", "SLA 99%"],
            ctaLabel: "联系商务",
            onContact: () => openContact("Studio 版"),
        },
        {
            key: "enterprise",
            name: "企业版",
            price: "年付 5 万起，按规模阶梯",
            audience: "定制部署与合规",
            features: ["Studio 全部权益", "私有部署", "独立 OSS", "合规审计", "API 接入", "专属客户经理"],
            ctaLabel: "联系商务",
            onContact: () => openContact("企业版", "contact@mosliy.com"),
        },
    ];

    const handleCta = (plan: PricingPlan) => {
        if (plan.onContact) {
            plan.onContact();
            return;
        }
        if (plan.ctaHref) {
            navigate(plan.ctaHref);
        }
    };

    return (
        <div className="flex min-h-dvh flex-col bg-[var(--bg)] text-[var(--brand)]">
            <PageHead title="幕山定价" description="幕山 Moshine 定价 · 个人创作者到企业团队，按需选择。" />

            {/* 顶栏：Logo + 返回首页 */}
            <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--workspace-border)] bg-[var(--bg)]/95 px-6 backdrop-blur-md lg:px-8">
                <Link to="/" aria-label="返回幕山首页">
                    <MoshineLogo variant="both" size="sm" showEnglishSubtitle={false} />
                </Link>
                <Link
                    to="/"
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--workspace-border)] px-3 py-1.5 text-[var(--fs-caption)] text-[var(--brand)] transition-colors hover:bg-[var(--brand-soft)]"
                    aria-label="返回首页"
                >
                    <ArrowLeft className="size-3.5" strokeWidth={1.8} />
                    返回首页
                </Link>
            </header>

            <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-14 lg:px-8 lg:py-20">
                {/* Hero */}
                <section className="text-center">
                    <h1 className="text-4xl font-bold leading-tight sm:text-5xl">幕山 · 定价</h1>
                    <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--brand)] opacity-65 sm:text-lg">
                        从免费开始，按你的节奏向上攀登。
                    </p>
                </section>

                {/* Pricing cards */}
                <section className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
                    {plans.map((plan) => (
                        <PricingCard key={plan.key} plan={plan} onCta={() => handleCta(plan)} />
                    ))}
                </section>

                {/* FAQ */}
                <section className="mx-auto mt-20 max-w-3xl">
                    <h2 className="text-center text-2xl font-bold">常见问题</h2>
                    <div className="mt-8 space-y-3">
                        {FAQ_ITEMS.map((item) => (
                            <details
                                key={item.question}
                                className="rounded-lg border border-[var(--workspace-border)] bg-[var(--brand-soft)] px-5 py-4"
                            >
                                <summary className="cursor-pointer text-base font-medium text-[var(--brand)]">
                                    {item.question}
                                </summary>
                                <p className="mt-3 text-sm leading-6 text-[var(--brand)] opacity-70">{item.answer}</p>
                            </details>
                        ))}
                    </div>
                </section>
            </main>

            <AppFooter />

            <ContactBizModal
                open={contactOpen}
                onClose={() => setContactOpen(false)}
                planTitle={contactPlan}
                defaultEmail={contactEmail}
            />
        </div>
    );
}

function PricingCard({ plan, onCta }: { plan: PricingPlan; onCta: () => void }) {
    return (
        <div
            className={`flex h-full flex-col rounded-lg bg-[var(--brand-soft)] p-6 ${
                plan.highlighted ? "border-2 border-[var(--brand)]" : "border border-[var(--workspace-border)]"
            }`}
        >
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--brand)]">{plan.name}</h3>
                {plan.highlighted ? (
                    <span className="rounded-full bg-[var(--brand)] px-2.5 py-0.5 text-[var(--fs-tiny)] font-semibold text-[var(--brand-contrast)]">
                        推荐
                    </span>
                ) : null}
            </div>
            <p className="mt-4 text-2xl font-bold leading-tight text-[var(--brand)]">{plan.price}</p>
            <p className="mt-1.5 text-sm text-[var(--brand)] opacity-60">{plan.audience}</p>

            <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-[var(--brand)] opacity-85">
                        <Check className="mt-0.5 size-4 shrink-0 text-[var(--brand)] opacity-55" strokeWidth={2.2} />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>

            <Button type={plan.ctaPrimary ? "primary" : "default"} onClick={onCta} block className="mt-6">
                {plan.ctaLabel}
            </Button>
        </div>
    );
}
