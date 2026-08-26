// 幕山攀登计划 · 活动 / 赛事 API 合同（spec Task 10 / §3.4）
//
// 复用 apiClient + request<T> 公共入口（AGENTS.md §4.1），
// 不另起 axios 实例；后端成功响应合同 { code: 0, data: T, msg: string }。
// 一期后端方法为 mock（activity.go 注释），前端按真实接口契约调用即可。

import { apiClient, request } from "@/services/api/request";

const api = apiClient;

export type ActivityStatus = "upcoming" | "active" | "judging" | "closed";

export type ActivityStageKind = "signup" | "collect" | "prelim" | "final" | "award";

export type ActivityStageSummary = {
    kind: ActivityStageKind;
    title: string;
    summary?: string;
    startAt?: string;
    endAt?: string;
};

export type ActivityRewardTierSummary = {
    title: string;
    summary?: string;
    credits: number;
};

export type ActivityListItem = {
    id: string;
    slug?: string;
    title: string;
    subtitle?: string;
    coverUrl?: string;
    status: ActivityStatus;
    entryFeeLabel?: string;
    poolLabel?: string;
    startedAt?: string;
    endedAt?: string;
};

export type ActivityListResult = {
    activities: ActivityListItem[];
    total: number;
    page: number;
    limit: number;
};

export type ActivityDetail = {
    id: string;
    slug?: string;
    title: string;
    subtitle?: string;
    bannerUrl?: string;
    coverUrl?: string;
    status: ActivityStatus;
    entryFee: number;
    entryFeeLabel?: string;
    poolAmount: number;
    poolLabel?: string;
    ruleSummary?: string;
    startedAt?: string;
    endedAt?: string;
    signupEndAt?: string;
    stages: ActivityStageSummary[];
    rewardTiers: ActivityRewardTierSummary[];
};

export type ActivityEntryStatus = "pending" | "confirmed" | "rejected" | "withdrawn";

export type SubmitActivityEntryRequest = {
    displayName: string;
    contact: string;
    track: string;
    note?: string;
};

export type SubmitActivityEntryResult = {
    entryId: string;
    activityId: string;
    status: ActivityEntryStatus;
    activateCredits: number;
    activateDays: number;
};

// 公开列表：未登录可调。
export function listPublicActivities(params: { keyword?: string; page?: number; limit?: number } = {}) {
    return request<ActivityListResult>(api.get("/activities", { params }));
}

// 公开详情：未登录可调。
export function getActivityDetail(idOrSlug: string) {
    return request<ActivityDetail>(api.get(`/activities/${encodeURIComponent(idOrSlug)}`));
}

// 报名：登录态调用。
export function submitActivityEntry(activityId: string, input: SubmitActivityEntryRequest) {
    return request<SubmitActivityEntryResult>(api.post(`/activities/${encodeURIComponent(activityId)}/entries`, input));
}

// 管理后台活动列表。
export function listAdminActivities(params: { keyword?: string; page?: number; limit?: number } = {}) {
    return request<ActivityListResult>(api.get("/admin/activities", { params }));
}

// 管理后台创建 / 更新活动（一期 mock 不入库）。
export function upsertAdminActivity(input: ActivityDetail) {
    return request<ActivityDetail>(api.post("/admin/activities", input));
}
