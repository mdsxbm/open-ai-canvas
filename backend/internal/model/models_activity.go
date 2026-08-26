package model

import "time"

// 幕山攀登计划 · 活动 / 赛事系统（spec §3.4 / Task 10）
//
// 一期 spec 明确：「一期定义结构 + 空 service 方法，不真的强制建表迁移成功就验收通过」，
// 因此本文件只负责定义 GORM 模型与状态枚举；service 层走 mock 实现。
// 二期接入真实赛事运营、报名校验、奖金发放时再补齐校验与索引策略。

// ActivityStatus 活动状态。
type ActivityStatus string

const (
	ActivityUpcoming ActivityStatus = "upcoming" // 即将开始
	ActivityActive   ActivityStatus = "active"   // 进行中
	ActivityJudging  ActivityStatus = "judging"   // 评审中
	ActivityClosed   ActivityStatus = "closed"    // 已结束
)

// ActivityStageKind 赛制阶梯步骤类型（spec §3.4 详情页 5 阶梯）。
type ActivityStageKind string

const (
	ActivityStageSignup    ActivityStageKind = "signup"    // 报名
	ActivityStageCollect   ActivityStageKind = "collect"   // 征集
	ActivityStagePrelim    ActivityStageKind = "prelim"    // 初评
	ActivityStageFinal     ActivityStageKind = "final"     // 复评
	ActivityStageAward     ActivityStageKind = "award"     // 颁奖
)

// ActivityEntryStatus 报名记录状态。
type ActivityEntryStatus string

const (
	ActivityEntryPending   ActivityEntryStatus = "pending"   // 已提交报名，等待审核
	ActivityEntryConfirmed ActivityEntryStatus = "confirmed" // 报名通过、参赛资格已激活
	ActivityEntryRejected  ActivityEntryStatus = "rejected"  // 报名驳回
	ActivityEntryWithdrawn ActivityEntryStatus = "withdrawn" // 用户主动退出
)

// Activity 活动 / 赛事主体记录。
// 一期 mock：service 层不查表，list/detail 返回内置 mock 活动；二期接入真实持久化。
type Activity struct {
	ID            string         `json:"id" gorm:"primaryKey;size:36"`
	Slug          string         `json:"slug,omitempty" gorm:"uniqueIndex;size:64"`
	Title         string         `json:"title" gorm:"size:200"`
	Subtitle      string         `json:"subtitle,omitempty" gorm:"size:300"`
	CoverURL      string         `json:"coverUrl,omitempty" gorm:"size:500"`
	BannerURL     string         `json:"bannerUrl,omitempty" gorm:"size:500"`
	Status        ActivityStatus `json:"status" gorm:"index;size:24"`
	EntryFee      int64          `json:"entryFee"` // 报名费（分），0 表示免费
	EntryFeeLabel string         `json:"entryFeeLabel,omitempty" gorm:"size:64"`
	PoolAmount    int64          `json:"poolAmount"` // 奖池金额（分）
	PoolLabel     string         `json:"poolLabel,omitempty" gorm:"size:64"`
	RuleSummary   string         `json:"ruleSummary,omitempty" gorm:"type:text"`
	StartedAt     *time.Time     `json:"startedAt,omitempty" gorm:"index"`
	EndedAt       *time.Time     `json:"endedAt,omitempty" gorm:"index"`
	SignupEndAt   *time.Time     `json:"signupEndAt,omitempty" gorm:"index"`
	Note          string         `json:"note,omitempty" gorm:"size:500"`
	CreatedBy     string         `json:"createdBy,omitempty" gorm:"index;size:36"`
	CreatedAt     time.Time      `json:"createdAt" gorm:"index"`
	UpdatedAt     time.Time      `json:"updatedAt"`
}

// ActivityStage 赛制阶梯步骤定义（spec §3.4：报名 / 征集 / 初评 / 复评 / 颁奖）。
type ActivityStage struct {
	ID         string            `json:"id" gorm:"primaryKey;size:36"`
	ActivityID string            `json:"activityId" gorm:"index;size:36"`
	Kind       ActivityStageKind `json:"kind" gorm:"size:24"`
	Title      string            `json:"title" gorm:"size:100"`
	Summary    string            `json:"summary,omitempty" gorm:"size:300"`
	StartAt    *time.Time        `json:"startAt,omitempty"`
	EndAt      *time.Time        `json:"endAt,omitempty"`
	Order      int               `json:"order"`
	CreatedAt  time.Time         `json:"createdAt"`
}

// ActivityRewardTier 奖励阶梯（spec §3.4 创作支持：报名 → 激活 → 发布 → 爆款 → 宣推）。
type ActivityRewardTier struct {
	ID         string    `json:"id" gorm:"primaryKey;size:36"`
	ActivityID string   `json:"activityId" gorm:"index;size:36"`
	Title      string    `json:"title" gorm:"size:100"`
	Summary    string    `json:"summary,omitempty" gorm:"size:300"`
	Credits    int64     `json:"credits"`
	Order      int       `json:"order"`
	CreatedAt  time.Time `json:"createdAt"`
}

// ActivityEntry 用户报名记录。一期 mock：service 不真入库，submit 返回 mock 报名结果。
type ActivityEntry struct {
	ID           string              `json:"id" gorm:"primaryKey;size:36"`
	ActivityID   string              `json:"activityId" gorm:"uniqueIndex:idx_activity_user,priority:1;size:36"`
	UserID       string              `json:"userId" gorm:"uniqueIndex:idx_activity_user,priority:2;index;size:36"`
	DisplayName  string              `json:"displayName,omitempty" gorm:"size:64"`
	Contact      string              `json:"contact,omitempty" gorm:"size:128"`
	Track        string              `json:"track,omitempty" gorm:"size:64"`
	Note         string              `json:"note,omitempty" gorm:"size:500"`
	Status       ActivityEntryStatus `json:"status" gorm:"index;size:24"`
	ActivateCredits int64           `json:"activateCredits"` // 报名成功激活的奖励积分
	ActivateDays int                 `json:"activateDays"`   // 奖励积分有效期天数
	SubmittedAt time.Time            `json:"submittedAt"`
	ReviewedAt  *time.Time           `json:"reviewedAt,omitempty"`
	ReviewerID  string               `json:"reviewerId,omitempty" gorm:"index;size:36"`
	CreatedAt   time.Time            `json:"createdAt"`
	UpdatedAt   time.Time            `json:"updatedAt"`
}
