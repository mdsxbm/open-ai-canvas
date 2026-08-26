package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"infinite-canvas/backend/internal/service"
)

// RegisterChannelAPIKeyRoutes 注册渠道 API Key 管理与项目渠道覆盖 API。
// 所有写路径都需要管理员或项目所有者；读路径遵循对应资源的归属校验。
func RegisterChannelAPIKeyRoutes(r gin.IRouter, svc *service.Service) {
	// 管理员：渠道级多 API Key 管理（与 /admin/channels/:id 同层级）
	r.GET("/admin/channels/:id/keys", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		keys, err := svc.AdminChannelAPIKeys(user, c.Param("id"))
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"keys": keys})
	})
	r.POST("/admin/channels/:id/keys", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		if !enforceRateLimit(c, "admin-channel-keys-save:"+user.ID, 20, time.Minute) {
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 64<<10)
		var req service.ChannelAPIKeyRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		key, err := svc.SaveChannelAPIKey(user, c.Param("id"), c.Query("keyId"), req)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"key": key})
	})
	r.DELETE("/admin/channels/:id/keys/:keyId", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		if err := svc.DeleteChannelAPIKey(user, c.Param("id"), c.Param("keyId")); err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{})
	})
	r.POST("/admin/channels/:id/keys/:keyId/active", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		if err := svc.SetChannelActiveAPIKey(user, c.Param("id"), c.Param("keyId")); err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{})
	})
	r.POST("/admin/channels/:id/keys/:keyId/reset-failures", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		if err := svc.ResetChannelAPIKeyFailures(user, c.Param("id"), c.Param("keyId")); err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{})
	})

	// 项目所有者：配置渠道覆盖
	r.GET("/projects/:projectId/channel-overrides", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		result, err := svc.GetProjectChannelOverrides(user, c.Param("projectId"))
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})
	r.PUT("/projects/:projectId/channel-overrides", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		if !enforceRateLimit(c, "project-channel-overrides:"+user.ID, 30, time.Minute) {
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 64<<10)
		var req service.ProjectChannelOverridesRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		if err := svc.SaveProjectChannelOverrides(user.ID, c.Param("projectId"), req); err != nil {
			failService(c, err)
			return
		}
		result, err := svc.GetProjectChannelOverrides(user, c.Param("projectId"))
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})
}
