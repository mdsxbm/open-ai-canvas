import { lazy, Suspense } from "react";

import { AdminPageFrame } from "../components/admin-shell";

const ActivitiesPanel = lazy(() => import("../components/activities-panel"));

// 幕山攀登计划 · 活动管理后台路由外壳（spec Task 10）
// 复用 RedemptionCodesPage 同款 AdminPageFrame + lazy panel 模式。
export default function ActivitiesPage() {
    return (
        <AdminPageFrame title="活动赛事" description="幕山攀登计划 · 创建与查看活动">
            <Suspense fallback={<div className="py-16 text-center text-sm text-foreground/50">正在读取活动列表...</div>}>
                <ActivitiesPanel />
            </Suspense>
        </AdminPageFrame>
    );
}
