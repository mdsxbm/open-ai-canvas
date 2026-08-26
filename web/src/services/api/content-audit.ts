import { apiClient, request } from "@/services/api/request";

const api = apiClient;

export type ContentAuditStatus = "pending" | "approved" | "rejected";
export type ContentAuditType = "text" | "image" | "video";

export type ContentAuditRecord = {
    id: string;
    userId: string;
    contentType: ContentAuditType;
    resourceId?: string;
    summary?: string;
    status: ContentAuditStatus;
    reason?: string;
    reviewerId?: string;
    reviewedAt?: string;
    createdAt: string;
};

export type ContentAuditListResult = {
    records: ContentAuditRecord[];
    total: number;
    page: number;
    limit: number;
    enabled: boolean;
};

export function listAdminContentAudits(params: { page?: number; limit?: number } = {}) {
    return request<ContentAuditListResult>(api.get("/admin/content-audit", { params }));
}

// 一期骨架：后端返回明确错误说明审核处理待二期开放。
export function resolveAdminContentAudit(id: string, input: { action: "approve" | "reject"; reason?: string }) {
    return request<{ ok: boolean }>(api.post(`/admin/content-audit/${encodeURIComponent(id)}/resolve`, input));
}
