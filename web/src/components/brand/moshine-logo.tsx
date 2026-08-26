import { cn } from "@/lib/utils";

/**
 * 幕山 Moshine 品牌 Logo 组件
 *
 * 极致黑白极简路线（spec §1.3）：
 * - Wordmark：中文「幕山」两字，纯黑/纯白单色，字重 700-800，无渐变
 * - Mark：44×44 圆角方块，内部用 ::before/::after 画「幕布齿孔 + 三竖山峰」负形
 *
 * 主题适配：亮色用幕山黑（var(--brand)），暗色自动翻转为幕山白（同 token）
 * 宽度策略：PC 顶栏 ≥1280px 展示 Wordmark + Mark；<1280px 只显示 Mark
 *
 * 验收映射：AC-BR-05、TR-01-02、TR-01-03
 */

export type MoshineLogoVariant = "wordmark" | "mark" | "both";
export type MoshineLogoSize = "sm" | "md" | "lg";

const SIZE_MAP: Record<MoshineLogoSize, { mark: number; wordmark: string; subtitle?: string }> = {
    sm: { mark: 24, wordmark: "text-[var(--fs-body)]" },
    md: { mark: 32, wordmark: "text-[var(--fs-heading-lg)]" },
    lg: {
        mark: 44,
        wordmark: "text-[var(--fs-title)]",
        subtitle: "text-[var(--fs-tiny)]",
    },
};

interface MoshineLogoProps {
    variant?: MoshineLogoVariant;
    size?: MoshineLogoSize;
    /** 是否展示英文副标「Moshine」（仅在 lg + both 模式生效，宽度 ≥1280 时使用） */
    showEnglishSubtitle?: boolean;
    /** 是否展示 Slogan 副标「每一帧，都值得立一座山」（仅在 lg + both 模式生效） */
    showSlogan?: boolean;
    className?: string;
    /** 链接地址，传入则渲染为 <a>，否则渲染为 <span> */
    href?: string;
    title?: string;
}

/**
 * 图形 Mark：44×44 圆角方块 + 负形「幕布齿孔 + 三竖山峰」
 * - 外框：var(--brand) 纯黑/纯白填充
 * - 内部用 ::before 画顶部 3 个小齿孔（幕布齿孔）
 * - 用 ::after 画底部三竖山峰（三竖结构）
 */
function MoshineMark({ size }: { size: number }) {
    return (
        <span
            className="moshine-mark relative grid shrink-0 place-items-center overflow-hidden"
            style={{
                width: size,
                height: size,
                borderRadius: Math.round(size * 0.32),
                background: "var(--brand)",
            }}
            aria-hidden="true"
        >
            {/* 幕布齿孔：顶部 3 个小方孔（负形 = 背景色透出） */}
            <span
                className="moshine-mark-perforations absolute"
                style={{
                    top: "18%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    gap: Math.max(1, Math.round(size * 0.05)),
                    height: Math.round(size * 0.12),
                }}
            >
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        style={{
                            width: Math.max(1.5, Math.round(size * 0.1)),
                            height: "100%",
                            background: "var(--brand-contrast)",
                            borderRadius: 1,
                        }}
                    />
                ))}
            </span>
            {/* 三竖山峰：底部三个不同高度的竖条，构成山形 */}
            <span
                className="moshine-mark-peaks absolute"
                style={{
                    bottom: "18%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    alignItems: "flex-end",
                    gap: Math.max(1, Math.round(size * 0.04)),
                    height: "42%",
                }}
            >
                {[
                    { w: 0.18, h: 0.55 },
                    { w: 0.22, h: 1 },
                    { w: 0.18, h: 0.7 },
                ].map((peak, i) => (
                    <span
                        key={i}
                        style={{
                            width: Math.max(2, Math.round(size * peak.w)),
                            height: `${peak.h * 100}%`,
                            background: "var(--brand-contrast)",
                            borderRadius: 1,
                        }}
                    />
                ))}
            </span>
        </span>
    );
}

/**
 * 字标 Wordmark：中文「幕山」+ 可选英文副标 + 可选 Slogan
 */
function MoshineWordmark({
    size,
    showEnglishSubtitle,
    showSlogan,
}: {
    size: MoshineLogoSize;
    showEnglishSubtitle?: boolean;
    showSlogan?: boolean;
}) {
    const sizeConfig = SIZE_MAP[size];
    return (
        <span className="moshine-wordmark flex flex-col leading-none">
            <span
                className={cn(
                    "font-bold tracking-tight",
                    sizeConfig.wordmark,
                )}
                style={{ color: "var(--brand)", letterSpacing: "-0.01em" }}
            >
                幕山
            </span>
            {(showEnglishSubtitle || showSlogan) && size === "lg" ? (
                <span
                    className={cn("mt-1 flex flex-col gap-0.5", sizeConfig.subtitle)}
                    style={{ color: "var(--brand)", opacity: 0.55 }}
                >
                    {showEnglishSubtitle ? <span>Moshine</span> : null}
                    {showSlogan ? <span>每一帧，都值得立一座山。</span> : null}
                </span>
            ) : null}
        </span>
    );
}

export function MoshineLogo({
    variant = "both",
    size = "md",
    showEnglishSubtitle = false,
    showSlogan = false,
    className,
    href,
    title = "幕山 Moshine",
}: MoshineLogoProps) {
    const sizeConfig = SIZE_MAP[size];
    const content = (
        <>
            {variant !== "wordmark" ? <MoshineMark size={sizeConfig.mark} /> : null}
            {variant !== "mark" ? (
                <MoshineWordmark
                    size={size}
                    showEnglishSubtitle={showEnglishSubtitle}
                    showSlogan={showSlogan}
                />
            ) : null}
        </>
    );

    const baseClass = cn(
        "moshine-logo inline-flex items-center gap-2 select-none",
        variant === "mark" && "gap-0",
        className,
    );

    if (href) {
        return (
            <a href={href} className={baseClass} title={title} aria-label={title}>
                {content}
            </a>
        );
    }
    return (
        <span className={baseClass} title={title} role="img" aria-label={title}>
            {content}
        </span>
    );
}
