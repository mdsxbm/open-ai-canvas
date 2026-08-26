import { lazy, Suspense } from "react";

import { AdminPageFrame } from "../components/admin-shell";

const InviteCodesPanel = lazy(() => import("../components/invite-codes-panel"));

// 幕山攀登计划 · 邀请码管理后台路由外壳（spec Task 09）
// 复用 RedemptionCodesPage 同款 AdminPageFrame + lazy panel 模式。
export default function InviteCodesPage() {
    return (
        <AdminPageFrame title="邀请码" description="幕山攀登计划 · 批量生成与核销查看">
            <Suspense fallback={<div className="py-16 text-center text-sm text-foreground/50">正在读取邀请码批次...</div>}>
                <InviteCodesPanel />
            </Suspense>
        </AdminPageFrame>
    );
}
