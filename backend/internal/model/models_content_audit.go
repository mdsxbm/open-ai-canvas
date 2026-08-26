package model

import "time"

// ContentAuditStatus 审核状态机：pending → approved / rejected。
type ContentAuditStatus string

const (
	ContentAuditPending  ContentAuditStatus = "pending"
	ContentAuditApproved ContentAuditStatus = "approved"
	ContentAuditRejected ContentAuditStatus = "rejected"
)

// ContentAuditType 审核对象类型：覆盖文本、图片、视频三类生成入口。
type ContentAuditType string

const (
	ContentAuditText  ContentAuditType = "text"
	ContentAuditImage ContentAuditType = "image"
	ContentAuditVideo ContentAuditType = "video"
)

// ContentAuditRecord 一期仅建表 + 骨架接口（spec §4.3）：
// 不接第三方内容安全服务，写入与审核均待二期启用；
// 开关 CANVAS_CONTENT_AUDIT_ENABLED 默认 false。
type ContentAuditRecord struct {
	ID          string             `json:"id" gorm:"primaryKey;size:36"`
	UserID      string             `json:"userId" gorm:"index;size:36"`
	ContentType ContentAuditType   `json:"contentType" gorm:"index;size:16"`
	ResourceID  string             `json:"resourceId,omitempty" gorm:"size:64"`
	Summary     string             `json:"summary,omitempty" gorm:"size:500"`
	Status      ContentAuditStatus `json:"status" gorm:"index;size:16"`
	Reason      string             `json:"reason,omitempty" gorm:"size:500"`
	ReviewerID  string             `json:"reviewerId,omitempty" gorm:"size:36"`
	ReviewedAt  *time.Time         `json:"reviewedAt,omitempty"`
	CreatedAt   time.Time          `json:"createdAt" gorm:"index"`
}
