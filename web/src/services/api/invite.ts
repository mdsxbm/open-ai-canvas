// 幕山攀登计划 · 邀请码 API 合同（spec Task 09 / §3.3）
//
// 复用 apiClient + request<T> 公共入口（AGENTS.md §4.1），
// 不另起 axios 实例；后端成功响应合同 { code: 0, data: T, msg: string }。
// 一期后端方法为 mock（invite.go 注释），前端按真实接口契约调用即可。

import { apiClient, request } from "@/services/api/request";

const api = apiClient;

// 邀请码校验结果（对应 service.InviteValidateResult）。
export type InviteValidateResult = {
    valid: boolean;
    code: string;
    remaining: number;
    inviteCode?: {
        id: string;
        code: string;
        quotaUsed: number;
        quotaTotal: number;
        status: string;
        expiresAt?: string;
    };
};

// 当前用户邀请页 summary（对应 service.UserInviteSummary）。
export type InviteRefereeSummary = {
    userId: string;
    displayName: string;
    username: string;
    registeredAt: string;
    charged: boolean;
    rewardCredits: number;
    status: string;
};

export type ReferralReward = {
    id: string;
    referrerId: string;
    refereeId: string;
    rewardType: string;
    credits: number;
    status: string;
    relatedOrderId?: string;
    createdAt: string;
};

export type UserInviteSummary = {
    inviteUrl: string;
    inviteCode: string;
    quotaUsed: number;
    quotaTotal: number;
    rewards: ReferralReward[];
    referees: InviteRefereeSummary[];
};

// 管理后台批次列表项（对应 model.InviteBatch）。
export type InviteBatch = {
    id: string;
    count: number;
    quotaPerCode: number;
    note?: string;
    createdBy: string;
    expiresAt?: string;
    createdAt: string;
    availableCount: number;
    consumedCount: number;
    disabledCount: number;
};

export type InviteBatchSummary = {
    batch: InviteBatch;
    codes: string[];
};

export type InviteBatchListResult = {
    batches: InviteBatch[];
    total: number;
    page: number;
    limit: number;
};

// 公开校验：未登录可调，注册页失焦校验使用。
export function validateInviteCode(code: string) {
    return request<InviteValidateResult>(api.get(`/invite/${encodeURIComponent(code)}/validate`));
}

// 当前用户邀请页 summary。
export function getCreatorInviteSummary() {
    return request<UserInviteSummary>(api.get("/creator/invite/summary"));
}

// 管理后台：批次列表（一期 mock 空列表）。
export function listAdminInviteBatches(params: { keyword?: string; page?: number; limit?: number } = {}) {
    return request<InviteBatchListResult>(api.get("/admin/invite/batches", { params }));
}

// 管理后台：批量生成邀请码（一期 mock 不入库，返回明文 codes）。
export function createAdminInviteBatch(input: { count: number; quotaPerCode: number; note?: string; expiresAt?: string }) {
    return request<InviteBatchSummary>(api.post("/admin/invite/generate-batch", input));
}
