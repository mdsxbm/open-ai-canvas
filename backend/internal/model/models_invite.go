package model

import "time"

// 幕山攀登计划邀请系统（spec §3.3）。一期 spec 明确：
// "一期定义结构 + 空 service 方法，不真的强制建表迁移成功就验收通过"，
// 因此本文件只负责定义 GORM 模型与状态枚举；service 层走 mock 实现。
// 二期接入真实校验、配额扣减、积分发奖时再补齐校验与索引策略。

type InviteCodeStatus string

const (
	InviteCodeActive   InviteCodeStatus = "active"   // 可用
	InviteCodeConsumed InviteCodeStatus = "consumed" // 已被注册使用
	InviteCodeDisabled InviteCodeStatus = "disabled" // 管理员停用
	InviteCodeExpired  InviteCodeStatus = "expired"  // 已过期
)

type ReferralRewardType string

const (
	ReferralRewardSignup      ReferralRewardType = "signup"       // 好友完成注册一次性奖励
	ReferralRewardFirstCharge ReferralRewardType = "first_charge" // 好友首次充值返利
)

type ReferralRewardStatus string

const (
	ReferralRewardPending   ReferralRewardStatus = "pending"   // 已记录但未发奖
	ReferralRewardFulfilled ReferralRewardStatus = "fulfilled" // 已发放积分
	ReferralRewardRevoked   ReferralRewardStatus = "revoked"   // 因退款或风控回滚
)

// InviteCode 邀请码记录。一期 mock 行为：不查表，validate 一律返回 valid=true。
type InviteCode struct {
	ID          string           `json:"id" gorm:"primaryKey;size:36"`
	Code        string           `json:"code" gorm:"uniqueIndex;size:32"`
	CodeHash    string           `json:"-" gorm:"index;size:64"`
	CodeSuffix  string           `json:"codeSuffix" gorm:"size:4"`
	BatchID     string           `json:"batchId,omitempty" gorm:"index;size:36"`
	CreatedBy   string           `json:"createdBy" gorm:"index;size:36"`
	QuotaUsed   int              `json:"quotaUsed"`
	QuotaTotal  int              `json:"quotaTotal"`
	Status      InviteCodeStatus `json:"status" gorm:"index;size:24"`
	ConsumedBy  string           `json:"consumedBy,omitempty" gorm:"index;size:36"`
	ConsumedAt  *time.Time       `json:"consumedAt"`
	ExpiresAt   *time.Time       `json:"expiresAt,omitempty" gorm:"index"`
	Note        string           `json:"note,omitempty" gorm:"size:500"`
	CreatedAt   time.Time        `json:"createdAt" gorm:"index"`
	UpdatedAt   time.Time        `json:"updatedAt"`
}

// InviteBatch 邀请码批次（管理员批量生成）。
type InviteBatch struct {
	ID             string     `json:"id" gorm:"primaryKey;size:36"`
	Count          int        `json:"count"`
	QuotaPerCode   int        `json:"quotaPerCode"`
	Note           string     `json:"note,omitempty" gorm:"size:500"`
	CreatedBy      string     `json:"createdBy" gorm:"index;size:36"`
	ExpiresAt      *time.Time `json:"expiresAt,omitempty" gorm:"index"`
	CreatedAt      time.Time  `json:"createdAt" gorm:"index"`
	AvailableCount int64      `json:"availableCount" gorm:"->;-:migration"`
	ConsumedCount  int64      `json:"consumedCount" gorm:"->;-:migration"`
	DisabledCount  int64      `json:"disabledCount" gorm:"->;-:migration"`
}

// ReferralReward 邀请奖励记录。一期空实现：表结构存在但不真正入账。
type ReferralReward struct {
	ID             string              `json:"id" gorm:"primaryKey;size:36"`
	ReferrerID     string              `json:"referrerId" gorm:"index;size:36"`
	RefereeID      string              `json:"refereeId" gorm:"index;size:36"`
	InviteCodeID   string              `json:"inviteCodeId,omitempty" gorm:"index;size:36"`
	RewardType     ReferralRewardType  `json:"rewardType" gorm:"index;size:32"`
	Credits        int64               `json:"credits"`
	Status         ReferralRewardStatus `json:"status" gorm:"index;size:24"`
	RelatedOrderID string              `json:"relatedOrderId,omitempty" gorm:"index;size:36"`
	Note           string              `json:"note,omitempty" gorm:"size:500"`
	FulfilledAt    *time.Time          `json:"fulfilledAt"`
	CreatedAt      time.Time           `json:"createdAt" gorm:"index"`
	UpdatedAt      time.Time           `json:"updatedAt"`
}
