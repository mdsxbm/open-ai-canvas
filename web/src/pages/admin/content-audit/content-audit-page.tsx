import { lazy, Suspense } from "react";

import { AdminPageFrame } from "../components/admin-shell";

const ContentAuditPanel = lazy(() => import("../components/content-audit-panel"));

// 管理后台 · 内容审核骨架路由外壳（spec Task 17）
// 复用 AdminPageFrame + lazy panel 模式，与活动 / 邀请码后台一致。
export default function ContentAuditPage() {
    return (
        <AdminPageFrame title="内容审核" description="文本 / 图片 / 视频合规队列骨架">
            <Suspense fallback={<div className="py-16 text-center text-sm text-foreground/50">正在读取审核队列...</div>}>
                <ContentAuditPanel />
            </Suspense>
        </AdminPageFrame>
    );
}
