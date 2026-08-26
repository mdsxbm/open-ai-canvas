import { Tooltip } from "antd";
import { HeartPulse } from "lucide-react";

import type { CharacterCardSummary } from "@/services/api/projects";

// 主角模式 · 角色健康度徽章（spec Task 13 / §3.7）
//
// 分层规则（TR-13-02）：≥80 绿 · 50–79 黄 · <50 红。
// 一期 mock：优先读 character.definition.protagonistHealth（0–100）；
// 未写入时按 representations 数量与 visualStatus 派生确定性分数，二期接入真实体检后再替换。
// TR-13-03：健康度 <70 时 tooltip 提示补图建议。

export type HealthLevel = "green" | "yellow" | "red";

export function healthLevelFor(score: number): HealthLevel {
    if (score >= 80) return "green";
    if (score >= 50) return "yellow";
    return "red";
}

export function protagonistHealthScore(character: CharacterCardSummary): number {
    // 优先读 metadata.protagonistHealth（spec Task 13 字段），其次兼容 definition 内的同名字段。
    const candidates = [character.metadata?.protagonistHealth, (character.definition as { protagonistHealth?: unknown }).protagonistHealth];
    for (const candidate of candidates) {
        const value = Number(candidate);
        if (Number.isFinite(value) && value >= 0 && value <= 100) return Math.round(value);
    }
    // mock 派生：视觉状态给基线，多角度 representation 逐个加分，封顶 100。
    const base = character.visualStatus === "ready" ? 68 : character.visualStatus === "partial" ? 42 : 20;
    const extraRoles = Math.max(0, character.representations.length - 1);
    return Math.min(100, base + extraRoles * 8);
}

const LEVEL_STYLES: Record<HealthLevel, { chip: string; label: string }> = {
    green: { chip: "bg-emerald-500/85 text-white", label: "一致性稳定" },
    yellow: { chip: "bg-amber-500/85 text-white", label: "可再补强" },
    red: { chip: "bg-red-500/85 text-white", label: "急需补图" },
};

export function CharacterHealthBadge({ character }: { character: CharacterCardSummary }) {
    const score = protagonistHealthScore(character);
    const level = healthLevelFor(score);
    const style = LEVEL_STYLES[level];
    const weak = score < 70;
    const tooltip = weak
        ? `健康度 ${score} · ${style.label}：建议补充侧脸、四分之三侧面或高清特写图`
        : `健康度 ${score} · ${style.label}`;
    return (
        <Tooltip title={tooltip}>
            <span
                data-testid="character-health-badge"
                data-level={level}
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[var(--fs-micro)] font-semibold tabular-nums ${style.chip}`}
            >
                <HeartPulse className="size-3" />
                {score}
            </span>
        </Tooltip>
    );
}
