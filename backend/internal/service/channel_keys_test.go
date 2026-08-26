package service

import (
	"strings"
	"testing"

	"infinite-canvas/backend/internal/model"
	"infinite-canvas/backend/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newChannelKeyTestService(t *testing.T) (*Service, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+newID()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.ModelChannel{}, &model.ChannelModel{}, &model.ChannelAPIKey{}, &model.Project{}, &model.CanvasProject{}); err != nil {
		t.Fatal(err)
	}
	return New(repository.New(db), t.TempDir()), db
}

func TestResolveChannelAPIKeyFallbackToLegacyKey(t *testing.T) {
	svc, _ := newChannelKeyTestService(t)
	channel := &model.ModelChannel{ID: "ch_a", APIKey: "legacy-api-key", SecretKey: "legacy-secret"}
	apiKey, secretKey, keyID, err := svc.ResolveChannelAPIKey(channel)
	if err != nil {
		t.Fatalf("ResolveChannelAPIKey() error = %v", err)
	}
	if apiKey != "legacy-api-key" || secretKey != "legacy-secret" || keyID != "" {
		t.Fatalf("ResolveChannelAPIKey() = (%q, %q, %q), want legacy fallback", apiKey, secretKey, keyID)
	}
}

func TestResolveChannelAPIKeyRejectsEmptyLegacyChannel(t *testing.T) {
	svc, db := newChannelKeyTestService(t)
	_ = db
	channel := &model.ModelChannel{ID: "ch_a"}
	if _, _, _, err := svc.ResolveChannelAPIKey(channel); err == nil {
		t.Fatal("ResolveChannelAPIKey() on empty channel expected error, got nil")
	}
}

func TestResolveChannelAPIKeyActiveLocked(t *testing.T) {
	svc, db := newChannelKeyTestService(t)
	channel := &model.ModelChannel{ID: "ch_a", ActiveAPIKeyID: "k2"}
	// 直接 repo 层写入：decrypt 看到无前缀明文会原样返回，避开 encryptSettingSecret 对 dataDir 实时 key 的依赖。
	keys := []model.ChannelAPIKey{
		{ID: "k1", ChannelID: "ch_a", Label: "key-1", APIKey: "api-1", APIKeySuffix: "api-1"[len("api-1")-4:], Enabled: true, Priority: 10},
		{ID: "k2", ChannelID: "ch_a", Label: "key-2", APIKey: "api-2", APIKeySuffix: "api-2"[len("api-2")-4:], Enabled: true, Priority: 50},
		{ID: "k3", ChannelID: "ch_a", Label: "key-3", APIKey: "api-3", APIKeySuffix: "api-3"[len("api-3")-4:], Enabled: false, Priority: 1},
	}
	for i := range keys {
		if err := db.Create(&keys[i]).Error; err != nil {
			t.Fatal(err)
		}
	}
	apiKey, _, keyID, err := svc.ResolveChannelAPIKey(channel)
	if err != nil {
		t.Fatalf("ResolveChannelAPIKey() error = %v", err)
	}
	if keyID != "k2" || apiKey != "api-2" {
		t.Fatalf("ResolveChannelAPIKey() active locked got (%q, %q), want k2/api-2", keyID, apiKey)
	}
}

func TestResolveChannelAPIKeyPriorityFallback(t *testing.T) {
	svc, db := newChannelKeyTestService(t)
	channel := &model.ModelChannel{ID: "ch_a"} // 无 ActiveAPIKeyID
	keys := []model.ChannelAPIKey{
		{ID: "k1", ChannelID: "ch_a", Label: "low", APIKey: "api-low", APIKeySuffix: "-low", Enabled: true, Priority: 50},
		{ID: "k2", ChannelID: "ch_a", Label: "first", APIKey: "api-first", APIKeySuffix: "irst", Enabled: true, Priority: 10},
		{ID: "k3", ChannelID: "ch_a", Label: "disabled", APIKey: "api-disabled", APIKeySuffix: "bled", Enabled: false, Priority: 1},
	}
	for i := range keys {
		if err := db.Create(&keys[i]).Error; err != nil {
			t.Fatal(err)
		}
	}
	apiKey, _, keyID, err := svc.ResolveChannelAPIKey(channel)
	if err != nil {
		t.Fatalf("ResolveChannelAPIKey() error = %v", err)
	}
	if keyID != "k2" || apiKey != "api-first" {
		t.Fatalf("ResolveChannelAPIKey() priority fallback got (%q, %q), want k2/api-first", keyID, apiKey)
	}
}

func TestMarkChannelAPIKeyFailureSkipsEmptyKeyID(t *testing.T) {
	svc, _ := newChannelKeyTestService(t)
	if err := svc.MarkChannelAPIKeyFailure(""); err != nil {
		t.Fatalf("MarkChannelAPIKeyFailure(\"\") error = %v, want nil passthrough", err)
	}
}

func TestMarkChannelAPIKeyFailureIncrementsCount(t *testing.T) {
	svc, db := newChannelKeyTestService(t)
	key := model.ChannelAPIKey{ID: "k1", ChannelID: "ch_a", APIKey: "x", APIKeySuffix: "x", Enabled: true, Priority: 10}
	if err := db.Create(&key).Error; err != nil {
		t.Fatal(err)
	}
	if err := svc.MarkChannelAPIKeyFailure("k1"); err != nil {
		t.Fatalf("MarkChannelAPIKeyFailure() error = %v", err)
	}
	var loaded model.ChannelAPIKey
	if err := db.First(&loaded, "id = ?", "k1").Error; err != nil {
		t.Fatal(err)
	}
	if loaded.FailureCount != 1 || loaded.LastFailedAt == nil {
		t.Fatalf("MarkChannelAPIKeyFailure() loaded = %#v", loaded)
	}
}

func TestSaveChannelAPIKeyValidatesLabel(t *testing.T) {
	svc, db := newChannelKeyTestService(t)
	admin := &model.User{ID: "admin", Role: model.UserRoleAdmin}
	channel := model.ModelChannel{ID: "ch_a", UserID: admin.ID, Scope: model.ChannelScopeSystem, Enabled: true, Name: "C", BaseURL: "https://example.com/v1", APIKey: "k", APIFormat: "openai", ModelsJSON: `[]`}
	if err := db.Create(&channel).Error; err != nil {
		t.Fatal(err)
	}
	_, err := svc.SaveChannelAPIKey(admin, channel.ID, "", ChannelAPIKeyRequest{Label: "", APIKey: "x"})
	if err == nil {
		t.Fatal("SaveChannelAPIKey() empty label expected error")
	}
}

func TestSaveChannelAPIKeyRejectsDuplicateLabel(t *testing.T) {
	svc, db := newChannelKeyTestService(t)
	admin := &model.User{ID: "admin", Role: model.UserRoleAdmin}
	channel := model.ModelChannel{ID: "ch_a", UserID: admin.ID, Scope: model.ChannelScopeSystem, Enabled: true, Name: "C", BaseURL: "https://example.com/v1", APIKey: "k", APIFormat: "openai", ModelsJSON: `[]`}
	if err := db.Create(&channel).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SaveChannelAPIKey(admin, channel.ID, "", ChannelAPIKeyRequest{Label: "primary", APIKey: "a"}); err != nil {
		t.Fatalf("first SaveChannelAPIKey() error = %v", err)
	}
	if _, err := svc.SaveChannelAPIKey(admin, channel.ID, "", ChannelAPIKeyRequest{Label: "primary", APIKey: "b"}); err == nil {
		t.Fatal("SaveChannelAPIKey() duplicate label expected error")
	}
}

func TestSaveChannelAPIKeyRequiresAdmin(t *testing.T) {
	svc, db := newChannelKeyTestService(t)
	regular := &model.User{ID: "u1", Role: model.UserRoleUser}
	channel := model.ModelChannel{ID: "ch_a", UserID: "admin", Scope: model.ChannelScopeSystem, Enabled: true, Name: "C", BaseURL: "https://example.com/v1", APIKey: "k", APIFormat: "openai", ModelsJSON: `[]`}
	if err := db.Create(&channel).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SaveChannelAPIKey(regular, channel.ID, "", ChannelAPIKeyRequest{Label: "l", APIKey: "x"}); err == nil {
		t.Fatal("SaveChannelAPIKey() by non-admin expected error")
	}
}

func TestSaveProjectChannelOverridesValidatesCapability(t *testing.T) {
	svc, db := newChannelKeyTestService(t)
	owner := &model.User{ID: "u1", Role: model.UserRoleUser}
	project := model.Project{ID: "p1", UserID: owner.ID, Name: "P", Status: model.ProjectStatusActive}
	if err := db.Create(&project).Error; err != nil {
		t.Fatal(err)
	}
	err := svc.SaveProjectChannelOverrides(owner.ID, project.ID, ProjectChannelOverridesRequest{
		Overrides: map[string]string{"invalid": "ch_x"},
		Version:   0,
	})
	if err == nil || !strings.Contains(err.Error(), "能力仅支持") {
		t.Fatalf("SaveProjectChannelOverrides() invalid capability error = %v", err)
	}
}

func TestSaveProjectChannelOverridesRejectsMissingChannel(t *testing.T) {
	svc, db := newChannelKeyTestService(t)
	owner := &model.User{ID: "u1", Role: model.UserRoleUser}
	project := model.Project{ID: "p1", UserID: owner.ID, Name: "P", Status: model.ProjectStatusActive}
	if err := db.Create(&project).Error; err != nil {
		t.Fatal(err)
	}
	err := svc.SaveProjectChannelOverrides(owner.ID, project.ID, ProjectChannelOverridesRequest{
		Overrides: map[string]string{"video": "ch_missing"},
		Version:   0,
	})
	if err == nil || !strings.Contains(err.Error(), "不存在或未启用") {
		t.Fatalf("SaveProjectChannelOverrides() missing channel error = %v", err)
	}
}

func TestSaveProjectChannelOverridesRejectsCapabilityMismatch(t *testing.T) {
	svc, db := newChannelKeyTestService(t)
	owner := &model.User{ID: "u1", Role: model.UserRoleUser}
	channel := model.ModelChannel{ID: "ch_image_only", UserID: owner.ID, Scope: model.ChannelScopeUser, Enabled: true, Name: "Image Only", BaseURL: "https://example.com/v1", APIKey: "k", APIFormat: "openai", ModelsJSON: `["img-1"]`}
	if err := db.Create(&channel).Error; err != nil {
		t.Fatal(err)
	}
	// 只挂 image 模型；不能被覆盖到 video。
	imageModel := model.ChannelModel{ID: "m1", ChannelID: channel.ID, ModelKey: "img-1", Capability: "image", Protocol: model.ChannelInterfaceOpenAIImage, Enabled: true}
	if err := db.Create(&imageModel).Error; err != nil {
		t.Fatal(err)
	}
	project := model.Project{ID: "p1", UserID: owner.ID, Name: "P", Status: model.ProjectStatusActive}
	if err := db.Create(&project).Error; err != nil {
		t.Fatal(err)
	}
	err := svc.SaveProjectChannelOverrides(owner.ID, project.ID, ProjectChannelOverridesRequest{
		Overrides: map[string]string{"video": channel.ID},
		Version:   0,
	})
	if err == nil || !strings.Contains(err.Error(), "不支持 video") {
		t.Fatalf("SaveProjectChannelOverrides() capability mismatch error = %v", err)
	}
}

func TestSaveProjectChannelOverridesRejectsAnotherUserChannel(t *testing.T) {
	svc, db := newChannelKeyTestService(t)
	owner := &model.User{ID: "u1", Role: model.UserRoleUser}
	other := &model.User{ID: "u2", Role: model.UserRoleUser}
	// 其他用户的 user-scope 渠道：不能被 u1 覆盖指向。
	channel := model.ModelChannel{ID: "ch_other", UserID: other.ID, Scope: model.ChannelScopeUser, Enabled: true, Name: "Other", BaseURL: "https://example.com/v1", APIKey: "k", APIFormat: "openai", ModelsJSON: `["x"]`}
	if err := db.Create(&channel).Error; err != nil {
		t.Fatal(err)
	}
	videoModel := model.ChannelModel{ID: "m1", ChannelID: channel.ID, ModelKey: "x", Capability: "video", Protocol: model.ChannelInterfaceOpenAIImage, Enabled: true}
	if err := db.Create(&videoModel).Error; err != nil {
		t.Fatal(err)
	}
	project := model.Project{ID: "p1", UserID: owner.ID, Name: "P", Status: model.ProjectStatusActive}
	if err := db.Create(&project).Error; err != nil {
		t.Fatal(err)
	}
	err := svc.SaveProjectChannelOverrides(owner.ID, project.ID, ProjectChannelOverridesRequest{
		Overrides: map[string]string{"video": channel.ID},
		Version:   0,
	})
	if err == nil || !strings.Contains(err.Error(), "不存在或未启用") {
		t.Fatalf("SaveProjectChannelOverrides() other-user channel error = %v", err)
	}
}

func TestSaveProjectChannelOverridesWritesJSONAndIncrementsVersion(t *testing.T) {
	svc, db := newChannelKeyTestService(t)
	owner := &model.User{ID: "u1", Role: model.UserRoleUser}
	channel := model.ModelChannel{ID: "ch_video", UserID: owner.ID, Scope: model.ChannelScopeUser, Enabled: true, Name: "Video", BaseURL: "https://example.com/v1", APIKey: "k", APIFormat: "openai", ModelsJSON: `["v"]`}
	if err := db.Create(&channel).Error; err != nil {
		t.Fatal(err)
	}
	videoModel := model.ChannelModel{ID: "m1", ChannelID: channel.ID, ModelKey: "v", Capability: "video", Protocol: model.ChannelInterfaceOpenAIImage, Enabled: true}
	if err := db.Create(&videoModel).Error; err != nil {
		t.Fatal(err)
	}
	project := model.Project{ID: "p1", UserID: owner.ID, Name: "P", Status: model.ProjectStatusActive}
	if err := db.Create(&project).Error; err != nil {
		t.Fatal(err)
	}
	if err := svc.SaveProjectChannelOverrides(owner.ID, project.ID, ProjectChannelOverridesRequest{
		Overrides: map[string]string{"video": channel.ID, "audio": ""}, // audio 空值 = 清除
		Version:   0,
	}); err != nil {
		t.Fatalf("SaveProjectChannelOverrides() error = %v", err)
	}
	var loaded model.Project
	if err := db.First(&loaded, "id = ?", project.ID).Error; err != nil {
		t.Fatal(err)
	}
	if loaded.ChannelOverrideVersion != 1 {
		t.Fatalf("ChannelOverrideVersion = %d, want 1", loaded.ChannelOverrideVersion)
	}
	if !strings.Contains(loaded.ChannelOverridesJSON, "video") || !strings.Contains(loaded.ChannelOverridesJSON, channel.ID) {
		t.Fatalf("ChannelOverridesJSON = %q, want video→%s", loaded.ChannelOverridesJSON, channel.ID)
	}
	// 版本不匹配时乐观锁拒绝。
	err := svc.SaveProjectChannelOverrides(owner.ID, project.ID, ProjectChannelOverridesRequest{
		Overrides: map[string]string{"video": channel.ID},
		Version:   0, // stale
	})
	if err == nil || !strings.Contains(err.Error(), "版本已过期") {
		t.Fatalf("SaveProjectChannelOverrides() stale version error = %v", err)
	}
}
