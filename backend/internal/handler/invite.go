package handler

import (
	"net/http"
	"strconv"

	"infinite-canvas/backend/internal/service"

	"github.com/gin-gonic/gin"
)

// RegisterInviteRoutes 邀请码公开路由（spec Task 09）
//
// 一期实现：
//   - GET /api/invite/:code/validate：未登录可调，返回 mock valid=true
//   - GET /api/creator/invite/summary：登录后返回当前用户邀请页 summary
//
// 不在 RegisterAdminRoutes 内单独挂载，便于一期与注册流程解耦。
func RegisterInviteRoutes(r *gin.RouterGroup, svc *service.Service) {
	r.GET("/invite/:code/validate", func(c *gin.Context) {
		result, err := svc.ValidateInviteCode(c.Param("code"))
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})

	r.GET("/creator/invite/summary", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		summary, err := svc.UserInviteSummary(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, summary)
	})
}

// RegisterAdminInviteRoutes 管理后台邀请码批量生成路由（spec Task 09）
//
// 一期实现：
//   - GET  /api/admin/invite/batches：批次列表（mock 空列表）
//   - POST /api/admin/invite/generate-batch：批量生成（mock 不入库）
//
// 鉴权沿用 RegisterAdminRoutes 内 RequireAdmin 模式，挂在 admin 子树
// 以便未来扩展批次明细、禁用、查询核销用户等管理能力。
func RegisterAdminInviteRoutes(r *gin.RouterGroup, svc *service.Service) {
	r.GET("/admin/invite/batches", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		result, err := svc.AdminListInviteBatches(user, service.AdminListQuery{Keyword: c.Query("keyword"), Page: page, Limit: limit})
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})

	r.POST("/admin/invite/generate-batch", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 64<<10)
		var req service.CreateInviteBatchRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		result, err := svc.CreateInviteBatch(user, req)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})
}
