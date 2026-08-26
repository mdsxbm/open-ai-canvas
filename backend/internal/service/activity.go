package service

import (
	"errors"
	"strings"
	"time"

	"infinite-canvas/backend/internal/model"
)

// 幕山攀登计划 · 活动 / 赛事系统（spec §3.4 / Task 10）
//
// 一期约束：service 方法以 mock 行为交付，不真实读写数据库、不真实发奖。
// 	- ListPublicActivities：返回内置 mock 活动 1 条（「第一期幕山投拍挑战赛 · 为故事立一座山」）
// 	- GetActivityDetail：返回该活动的完整阶梯与奖励阶梯
// 	- SubmitActivityEntry：返回 mock 报名成功结果，不真入库
// 二期接入真实赛事运营、报名校验、奖金发放时再切换为查表 + 配额判断 + 防重复逻辑。

// ActivityStageSummary 活动详情中的赛制阶梯项。
type ActivityStageSummary struct {
	Kind    model.ActivityStageKind `json:"kind"`
	Title   string                  `json:"title"`
	Summary string                  `json:"summary,omitempty"`
	StartAt *time.Time              `json:"startAt,omitempty"`
	EndAt   *time.Time              `json:"endAt,omitempty"`
}

// ActivityRewardTierSummary 活动详情中的奖励阶梯项。
type ActivityRewardTierSummary struct {
	Title   string `json:"title"`
	Summary string `json:"summary,omitempty"`
	Credits int64  `json:"credits"`
}

// ActivityDetail 活动详情页所需完整信息。
type ActivityDetail struct {
	ID            string                         `json:"id"`
	Slug          string                         `json:"slug,omitempty"`
	Title         string                         `json:"title"`
	Subtitle      string                         `json:"subtitle,omitempty"`
	BannerURL     string                         `json:"bannerUrl,omitempty"`
	CoverURL      string                         `json:"coverUrl,omitempty"`
	Status        model.ActivityStatus            `json:"status"`
	EntryFee      int64                          `json:"entryFee"`
	EntryFeeLabel string                          `json:"entryFeeLabel,omitempty"`
	PoolAmount    int64                          `json:"poolAmount"`
	PoolLabel     string                          `json:"poolLabel,omitempty"`
	RuleSummary   string                          `json:"ruleSummary,omitempty"`
	StartedAt     *time.Time                     `json:"startedAt,omitempty"`
	EndedAt       *time.Time                     `json:"endedAt,omitempty"`
	SignupEndAt   *time.Time                     `json:"signupEndAt,omitempty"`
	Stages        []ActivityStageSummary         `json:"stages"`
	RewardTiers   []ActivityRewardTierSummary    `json:"rewardTiers"`
}

// ActivityListResult 公开列表分页结果。
type ActivityListResult struct {
	Activities []ActivityListItem `json:"activities"`
	Total      int64              `json:"total"`
	Page       int                `json:"page"`
	Limit      int                `json:"limit"`
}

// ActivityListItem 列表页卡片所需摘要字段。
type ActivityListItem struct {
	ID            string              `json:"id"`
	Slug          string              `json:"slug,omitempty"`
	Title         string              `json:"title"`
	Subtitle      string              `json:"subtitle,omitempty"`
	CoverURL      string              `json:"coverUrl,omitempty"`
	Status        model.ActivityStatus `json:"status"`
	EntryFeeLabel string              `json:"entryFeeLabel,omitempty"`
	PoolLabel     string              `json:"poolLabel,omitempty"`
	StartedAt     *time.Time          `json:"startedAt,omitempty"`
	EndedAt       *time.Time          `json:"endedAt,omitempty"`
}

// SubmitActivityEntryRequest 用户报名表单入参（spec §3.4 报名弹窗至少 3 字段）。
type SubmitActivityEntryRequest struct {
	DisplayName string `json:"displayName"`
	Contact     string `json:"contact"`
	Track       string `json:"track"`
	Note        string `json:"note,omitempty"`
}

// SubmitActivityEntryResult 报名结果。
type SubmitActivityEntryResult struct {
	EntryID          string                    `json:"entryId"`
	ActivityID       string                    `json:"activityId"`
	Status           model.ActivityEntryStatus `json:"status"`
	ActivateCredits  int64                     `json:"activateCredits"`
	ActivateDays     int                        `json:"activateDays"`
}

// mockActivityDetail 一期内置赛事详情（spec §3.4：「第一期幕山投拍挑战赛」奖池 10000 元）。
func mockActivityDetail() ActivityDetail {
	startedAt := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	signupEndAt := time.Date(2026, 9, 30, 23, 59, 59, 0, time.UTC)
	endedAt := time.Date(2026, 11, 30, 23, 59, 59, 0, time.UTC)
	stages := []ActivityStageSummary{
		{Kind: model.ActivityStageSignup, Title: "报名", Summary: "创作者提交报名表单，激活参赛资格与 500 积分体验额度。", StartAt: &startedAt, EndAt: &signupEndAt},
		{Kind: model.ActivityStageCollect, Title: "征集", Summary: "完成 1-3 分钟原创短剧或风格转绘作品并提交至幕山。", StartAt: &signupEndAt, EndAt: &endedAt},
		{Kind: model.ActivityStagePrelim, Title: "初评", Summary: "幕山编辑部从剧情、画面、声音、一致性四个维度筛选入围作品。", StartAt: nil, EndAt: nil},
		{Kind: model.ActivityStageFinal, Title: "复评", Summary: "邀请行业导演、制片人对入围作品打分，决定金 / 银 / 铜奖归属。", StartAt: nil, EndAt: nil},
		{Kind: model.ActivityStageAward, Title: "颁奖", Summary: "公布获奖名单与社媒人气奖，所有获奖作品进入幕山首映专栏。", StartAt: nil, EndAt: nil},
	}
	rewardTiers := []ActivityRewardTierSummary{
		{Title: "报名奖励", Summary: "报名成功即激活参赛资格", Credits: 500},
		{Title: "发布奖励", Summary: "成功提交符合要求的作品", Credits: 1000},
		{Title: "爆款奖励", Summary: "作品在幕山首映累计播放 ≥ 1 万", Credits: 3000},
		{Title: "宣推奖励", Summary: "将作品转发到抖音 / 小红书 / 视频号并@幕山", Credits: 800},
	}
	return ActivityDetail{
		ID:            "act-moshine-001",
		Slug:          "moshine-challenge-001",
		Title:         "第一期幕山投拍挑战赛 · 为故事立一座山",
		Subtitle:      "面向中文创作者的 AI 短剧公开赛，奖励每一座为故事立起的山。",
		BannerURL:     "https://mosliy.com/og/activity-001.svg",
		CoverURL:      "https://mosliy.com/og/activity-001-cover.svg",
		Status:        model.ActivityActive,
		EntryFee:      0,
		EntryFeeLabel: "全程免费",
		PoolAmount:    1_000_000, // 10000 元，以分为单位
		PoolLabel:     "¥10,000 总奖池",
		RuleSummary:   "征集 1-3 分钟原创短剧或风格转绘作品；鼓励使用幕山投拍与主角模式；不接受侵犯第三方版权的内容；获奖作品授权幕山在首映与社媒展示。",
		StartedAt:     &startedAt,
		EndedAt:       &endedAt,
		SignupEndAt:   &signupEndAt,
		Stages:        stages,
		RewardTiers:   rewardTiers,
	}
}

// ListPublicActivities 一期 mock：返回内置赛事列表。
func (s *Service) ListPublicActivities(query AdminListQuery) (*ActivityListResult, error) {
	page := query.Page
	if page <= 0 {
		page = 1
	}
	limit := query.Limit
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	detail := mockActivityDetail()
	item := ActivityListItem{
		ID:            detail.ID,
		Slug:          detail.Slug,
		Title:         detail.Title,
		Subtitle:      detail.Subtitle,
		CoverURL:      detail.CoverURL,
		Status:        detail.Status,
		EntryFeeLabel: detail.EntryFeeLabel,
		PoolLabel:     detail.PoolLabel,
		StartedAt:     detail.StartedAt,
		EndedAt:       detail.EndedAt,
	}
	return &ActivityListResult{
		Activities: []ActivityListItem{item},
		Total:      1,
		Page:       page,
		Limit:      limit,
	}, nil
}

// GetActivityDetail 一期 mock：根据 id 或 slug 返回内置赛事详情；未命中返回错误。
func (s *Service) GetActivityDetail(identifier string) (*ActivityDetail, error) {
	identifier = strings.TrimSpace(identifier)
	if identifier == "" {
		return nil, BadAuthRequest("活动标识不能为空")
	}
	detail := mockActivityDetail()
	if identifier == detail.ID || identifier == detail.Slug {
		return &detail, nil
	}
	return nil, NotFound("活动不存在或已下架")
}

// SubmitActivityEntry 一期 mock：校验入参非空后返回报名成功结果。
// spec TR-10-03：报名成功 Toast 显示「报名成功，参赛资格已激活，奖励 500 积分 7 天有效」。
func (s *Service) SubmitActivityEntry(user *model.User, activityID string, req SubmitActivityEntryRequest) (*SubmitActivityEntryResult, error) {
	if user == nil {
		return nil, Unauthorized("请先登录")
	}
	activityID = strings.TrimSpace(activityID)
	if activityID == "" {
		return nil, BadAuthRequest("活动标识不能为空")
	}
	detail := mockActivityDetail()
	if activityID != detail.ID && activityID != detail.Slug {
		return nil, NotFound("活动不存在或已下架")
	}
	if strings.TrimSpace(req.DisplayName) == "" || strings.TrimSpace(req.Contact) == "" || strings.TrimSpace(req.Track) == "" {
		return nil, BadAuthRequest("请填写完整的报名信息：姓名 / 联系方式 / 作品赛道")
	}
	return &SubmitActivityEntryResult{
		EntryID:         newID(),
		ActivityID:      detail.ID,
		Status:          model.ActivityEntryConfirmed,
		ActivateCredits: 500,
		ActivateDays:    7,
	}, nil
}

// AdminListActivities 管理后台活动列表。一期 mock：返回内置赛事 1 条。
func (s *Service) AdminListActivities(actor *model.User, query AdminListQuery) (*ActivityListResult, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	return s.ListPublicActivities(query)
}

// AdminUpsertActivity 管理后台创建 / 更新活动。一期 mock：参数校验后返回内置 mock。
// spec §3.4：「管理后台 /admin/activities CRUD 骨架」，一期只占位接口，二期接入真实持久化。
func (s *Service) AdminUpsertActivity(actor *model.User, detail ActivityDetail) (*ActivityDetail, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	if strings.TrimSpace(detail.Title) == "" {
		return nil, errors.New("活动标题不能为空")
	}
	mock := mockActivityDetail()
	return &mock, nil
}
