package service

import (
	"errors"
	"strings"
	"time"

	"infinite-canvas/backend/internal/model"
)

// 邀请系统（幕山攀登计划 spec §3.3）
//
// 一期约束：service 方法以 mock 行为交付，不真实读写数据库、不真实发奖。
// 后端 ValidateInviteCode 对任何非空 code 一律返回 valid=true，
// 用于打通"注册页邀请码失焦校验 → 按钮启用"流程（TR-09-02）。
// 二期接入真实表结构与配额扣减后再替换实现。

// InviteValidateResult 邀请码校验结果。
type InviteValidateResult struct {
	Valid     bool               `json:"valid"`
	Code      string             `json:"code"`
	Remaining int                `json:"remaining"`
	InviteCode *model.InviteCode `json:"inviteCode,omitempty"`
}

// CreateInviteBatchRequest 管理员批量生成邀请码入参。
type CreateInviteBatchRequest struct {
	Count        int        `json:"count"`
	QuotaPerCode int        `json:"quotaPerCode"`
	Note         string     `json:"note,omitempty"`
	ExpiresAt    *time.Time `json:"expiresAt,omitempty"`
}

// InviteBatchSummary 创建批次后返回的批次信息 + 明文邀请码列表。
type InviteBatchSummary struct {
	Batch model.InviteBatch `json:"batch"`
	Codes []string          `json:"codes"`
}

// InviteBatchListResult 批次列表分页结果。
type InviteBatchListResult struct {
	Batches []model.InviteBatch `json:"batches"`
	Total   int64               `json:"total"`
	Page    int                 `json:"page"`
	Limit   int                `json:"limit"`
}

// UserInviteSummary 当前用户的邀请页 summary。
type UserInviteSummary struct {
	InviteURL  string                    `json:"inviteUrl"`
	InviteCode string                    `json:"inviteCode"`
	QuotaUsed  int                       `json:"quotaUsed"`
	QuotaTotal int                       `json:"quotaTotal"`
	Rewards    []model.ReferralReward    `json:"rewards"`
	Referees   []InviteRefereeSummary    `json:"referees"`
}

// InviteRefereeSummary 已邀请好友摘要。
type InviteRefereeSummary struct {
	UserID        string `json:"userId"`
	DisplayName   string `json:"displayName"`
	Username      string `json:"username"`
	RegisteredAt  string `json:"registeredAt"`
	Charged       bool   `json:"charged"`
	RewardCredits int64  `json:"rewardCredits"`
	Status        string `json:"status"`
}

// ValidateInviteCode 一期 mock：任何非空 code 一律返回 valid=true。
// spec TR-09-02 要求 /api/invite/TST001/validate 返回 200 后按钮 enable，
// 因此一期不查表，直接放行；二期接入真实校验时再切换为查表 + 配额判断。
func (s *Service) ValidateInviteCode(code string) (*InviteValidateResult, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return &InviteValidateResult{Valid: false, Code: code}, nil
	}
	return &InviteValidateResult{
		Valid:     true,
		Code:      code,
		Remaining: 1,
	}, nil
}

// UserInviteSummary 当前用户邀请页 summary。一期 mock：返回基于用户 ID 派生的邀请码，
// 不真入库；配额默认免费用户 2 个（spec §3.3 奖励规则）。二期接入真实邀请码表。
func (s *Service) UserInviteSummary(user *model.User) (*UserInviteSummary, error) {
	if user == nil {
		return nil, Unauthorized("请先登录")
	}
	code := generateMockInviteCode(user.ID)
	return &UserInviteSummary{
		InviteURL:  "https://mosliy.com/?invite=" + code,
		InviteCode: code,
		QuotaUsed:  0,
		QuotaTotal: 2,
		Rewards:    []model.ReferralReward{},
		Referees:   []InviteRefereeSummary{},
	}, nil
}

// CreateInviteBatch 管理员批量生成邀请码。一期 mock：生成 N 个 8 位字符码，
// 不真入库；返回批次元信息供前端展示。二期接入真实持久化后再切换。
func (s *Service) CreateInviteBatch(actor *model.User, req CreateInviteBatchRequest) (*InviteBatchSummary, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	if req.Count <= 0 || req.Count > 5000 {
		return nil, errors.New("生成数量需在 1-5000 之间")
	}
	quota := req.QuotaPerCode
	if quota <= 0 {
		quota = 1
	}
	codes := make([]string, 0, req.Count)
	for i := 0; i < req.Count; i++ {
		// 一期 mock：用递增种子避免重复；二期替换为真实唯一码生成 + 入库。
		codes = append(codes, generateMockInviteCode(newID()+string(rune('A'+i%26))))
	}
	now := time.Now()
	batch := model.InviteBatch{
		ID:             newID(),
		Count:          req.Count,
		QuotaPerCode:   quota,
		Note:           req.Note,
		CreatedBy:      actor.ID,
		ExpiresAt:      req.ExpiresAt,
		CreatedAt:      now,
		AvailableCount: int64(req.Count),
		ConsumedCount:  0,
		DisabledCount:  0,
	}
	return &InviteBatchSummary{Batch: batch, Codes: codes}, nil
}

// AdminListInviteBatches 管理员批次列表。一期 mock：返回空列表 + 总数 0。
func (s *Service) AdminListInviteBatches(actor *model.User, query AdminListQuery) (*InviteBatchListResult, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	page := query.Page
	if page <= 0 {
		page = 1
	}
	limit := query.Limit
	if limit <= 0 {
		limit = 20
	}
	return &InviteBatchListResult{
		Batches: []model.InviteBatch{},
		Total:   0,
		Page:    page,
		Limit:   limit,
	}, nil
}

// ConsumeReferralReward 一期 mock：不真实扣减邀请码配额、不发放积分。
// 注册成功时调用此方法用于预留接入点；二期再实现真实发奖 + 防重复逻辑。
func (s *Service) ConsumeReferralReward(referrerID, refereeID, code string) error {
	_ = referrerID
	_ = refereeID
	_ = code
	return nil
}

// generateMockInviteCode 一期 mock：基于 seed 生成 8 位 A-Z0-9 邀请码。
// 不保证全局唯一；二期接入真实表时替换为 crypto/rand + 唯一性校验。
func generateMockInviteCode(seed string) string {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	if len(seed) == 0 {
		seed = "moshine"
	}
	out := make([]byte, 8)
	for i := 0; i < 8; i++ {
		out[i] = charset[(int(seed[i%len(seed)])+i*7)%len(charset)]
	}
	return string(out)
}
