import { Clapperboard, FolderKanban, LayoutGrid, type LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router";

import { cn } from "@/lib/utils";

/**
 * 幕山工作坊 · 内部分组侧栏（spec Task 03）
 *
 * 仅在「幕山工作坊」相关页面（/studio/projects、/canvas、/tasks）使用，
 * 提供「我的项目 / 我的画布 / 制作任务」三个一级入口的二级导航。
 * 一期作为骨架，等 Task 06/07 接入项目子页后再扩展层级。
 */
export interface StudioNavGroup {
    label: string;
    to: string;
    icon: LucideIcon;
    /** 路径前缀匹配（startsWith），用于 active 判断 */
    matchPrefix: string[];
}

const STUDIO_NAV: StudioNavGroup[] = [
    {
        label: "我的项目",
        to: "/studio/projects",
        icon: FolderKanban,
        matchPrefix: ["/studio/projects", "/projects"],
    },
    {
        label: "我的画布",
        to: "/canvas",
        icon: LayoutGrid,
        matchPrefix: ["/canvas"],
    },
    {
        label: "制作任务",
        to: "/tasks",
        icon: Clapperboard,
        matchPrefix: ["/tasks"],
    },
];

export function StudioNav() {
    const { pathname } = useLocation();
    return (
        <nav
            className="app-studio-nav flex h-full w-full flex-col gap-1 px-2 py-3"
            aria-label="幕山工作坊内部分组"
        >
            <p className="px-2 pb-1 text-[var(--fs-tiny)] font-semibold uppercase tracking-wider text-[var(--brand)] opacity-55">
                幕山工作坊
            </p>
            {STUDIO_NAV.map((item) => {
                const Icon = item.icon;
                const active = item.matchPrefix.some((prefix) => pathname.startsWith(prefix));
                return (
                    <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                            "app-studio-nav-link flex h-9 items-center gap-2 rounded-md px-2.5 text-[var(--fs-caption)] transition-colors",
                            active
                                ? "bg-[var(--brand-soft)] font-medium text-[var(--brand)]"
                                : "text-[var(--brand)] opacity-65 hover:bg-[var(--brand-soft)] hover:opacity-100",
                        )}
                        aria-current={active ? "page" : undefined}
                    >
                        <Icon className="size-3.5 shrink-0" strokeWidth={1.8} />
                        <span className="truncate">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}

export default StudioNav;
