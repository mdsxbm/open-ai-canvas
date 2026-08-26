package handler

import (
	"net/http"
	"strconv"

	"infinite-canvas/backend/internal/service"

	"github.com/gin-gonic/gin"
)

// 幕山攀登计划 · 活动 / 赛事路由（spec Task 10）
//
// 一期实现：
//   - GET  /api/activities               公开列表（mock 1 条）
//   - GET  /api/activities/:id           公开详情（mock 赛事）
//   - POST /api/activities/:id/entries   登录后报名，返回 mock 报名结果
//   - GET  /api/admin/activities         管理后台列表（mock 同公开）
//   - POST /api/admin/activities         管理后台创建 / 更新（mock 不入库）
//
// 公开路由（activities/*）不要求登录；报名路由走 currentUser 但不强校验管理员。
func RegisterActivityRoutes(r *gin.RouterGroup, svc *service.Service) {
	r.GET("/activities", func(c *gin.Context) {
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		result, err := svc.ListPublicActivities(service.AdminListQuery{Keyword: c.Query("keyword"), Page: page, Limit: limit})
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})

	r.GET("/activities/:id", func(c *gin.Context) {
		result, err := svc.GetActivityDetail(c.Param("id"))
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})

	r.POST("/activities/:id/entries", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 64<<10)
		var req service.SubmitActivityEntryRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		result, err := svc.SubmitActivityEntry(user, c.Param("id"), req)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})
}

// RegisterAdminActivityRoutes 管理后台活动路由（spec Task 10）。
func RegisterAdminActivityRoutes(r *gin.RouterGroup, svc *service.Service) {
	r.GET("/admin/activities", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		result, err := svc.AdminListActivities(user, service.AdminListQuery{Keyword: c.Query("keyword"), Page: page, Limit: limit})
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})

	r.POST("/admin/activities", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 256<<10)
		var detail service.ActivityDetail
		if err := c.ShouldBindJSON(&detail); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		result, err := svc.AdminUpsertActivity(user, detail)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})
}
