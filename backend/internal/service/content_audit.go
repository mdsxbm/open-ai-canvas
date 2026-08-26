package service

import (
	"os"
	"strings"

	"infinite-canvas/backend/internal/model"
)

type ContentAuditListResult struct {
	Records []model.ContentAuditRecord `json:"records"`
	Total   int64                      `json:"total"`
	Page    int                        `json:"page"`
	Limit   int                        `json:"limit"`
	Enabled bool                       `json:"enabled"`
}

type ResolveContentAuditRequest struct {
	Action string `json:"action"` // approve / reject
	Reason string `json:"reason"`
}

// ContentAuditEnabled 内容审核总开关：默认关闭，显式设置 true / 1 才开启。
func ContentAuditEnabled() bool {
	value := strings.TrimSpace(os.Getenv("CANVAS_CONTENT_AUDIT_ENABLED"))
	return value == "true" || value == "1"
}

// AdminListContentAudits 一期骨架：开关状态 + 空列表。
// 记录写入依赖二期接入内容安全服务后的队列消费，当前不产生待审数据。
func (s *Service) AdminListContentAudits(actor *model.User, query AdminListQuery) (*ContentAuditListResult, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	page := query.Page
	if page <= 0 {
		page = 1
	}
	limit := query.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	return &ContentAuditListResult{Records: []model.ContentAuditRecord{}, Total: 0, Page: page, Limit: limit, Enabled: ContentAuditEnabled()}, nil
}

// AdminResolveContentAudit 一期骨架：审核处理待第三方服务接入后开放。
func (s *Service) AdminResolveContentAudit(actor *model.User, id string, req ResolveContentAuditRequest) error {
	if err := s.RequireAdmin(actor); err != nil {
		return err
	}
	if req.Action != "approve" && req.Action != "reject" {
		return BadAuthRequest("审核动作只支持通过或驳回")
	}
	return BadAuthRequest("内容审核二期接入内容安全服务后开放处理")
}
