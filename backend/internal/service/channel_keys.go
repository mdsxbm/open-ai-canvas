package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"infinite-canvas/backend/internal/model"

	"gorm.io/gorm"
)

// ChannelAPIKeyRequest 是 admin 创建/编辑渠道 API Key 的请求体。
// APIKey/SecretKey 编辑时传空表示保留原值，与系统渠道编辑行为一致。
type ChannelAPIKeyRequest struct {
	Label     string `json:"label"`
	APIKey    string `json:"apiKey"`
	SecretKey string `json:"secretKey"`
	Enabled   *bool  `json:"enabled"`
	Priority  *int   `json:"priority"`
	// Active 为 true 时把该 Key 设为渠道当前生效 Key（写 ModelChannel.ActiveAPIKeyID）。
	Active bool `json:"active"`
}

// ProjectChannelOverridesRequest 是项目级渠道覆盖保存请求。
// Version 是乐观锁：必须与当前 DB 版本一致才写入，并发编辑时后写方失败。
type ProjectChannelOverridesRequest struct {
	Overrides map[string]string `json:"overrides"`
	Version   int64             `json:"version"`
}

// channelOverrideCapabilities 是项目级覆盖允许的能力集合，与生成任务能力对齐。
var channelOverrideCapabilities = map[string]bool{
	"text": true, "image": true, "video": true, "audio": true,
}

// ResolveChannelAPIKey 按 ActiveAPIKeyID + priority + enabled 选出当前生效的 API Key。
// 旧渠道（无子表记录）回退到 ModelChannel.APIKey/SecretKey，零迁移兼容。
// 入参 channel 的 APIKey/SecretKey 必须已解密（adminSystemChannel/SystemChannel 已处理）。
// 选不到返回 error，不静默用空 Key 走请求，避免免费生成或鉴权失败循环。
func (s *Service) ResolveChannelAPIKey(channel *model.ModelChannel) (apiKey string, secretKey string, keyID string, err error) {
	keys, err := s.repo.ChannelAPIKeys(channel.ID, true)
	if err != nil {
		return "", "", "", err
	}
	if len(keys) == 0 {
		// 兼容回退：无子表记录时用旧单 Key 字段
		if strings.TrimSpace(channel.APIKey) == "" {
			return "", "", "", errors.New("渠道未配置 API Key")
		}
		return channel.APIKey, channel.SecretKey, "", nil
	}
	if err := s.decryptChannelAPIKeys(keys); err != nil {
		return "", "", "", err
	}
	// 显式 active 优先；active Key 被禁用或不存在时走 priority fallback，不静默失败
	if channel.ActiveAPIKeyID != "" {
		for _, k := range keys {
			if k.ID == channel.ActiveAPIKeyID {
				return k.APIKey, k.SecretKey, k.ID, nil
			}
		}
	}
	sort.SliceStable(keys, func(i, j int) bool { return keys[i].Priority < keys[j].Priority })
	// keys 已按 enabledOnly 过滤，priority 升序第一把即当前生效 Key
	return keys[0].APIKey, keys[0].SecretKey, keys[0].ID, nil
}

// MarkChannelAPIKeyFailure 标记某把 Key 失败，不自动切换。
// 只应由渠道鉴权/限流类错误（401/403/429）触发；网络错误不标记，避免误伤。
// keyID 为空（旧渠道回退路径）时静默跳过。
func (s *Service) MarkChannelAPIKeyFailure(keyID string) error {
	if strings.TrimSpace(keyID) == "" {
		return nil
	}
	return s.repo.IncrementChannelAPIKeyFailure(keyID, time.Now())
}

// TouchChannelAPIKeyUsed 记录 Key 最近使用时间；keyID 为空时跳过（旧渠道回退路径）。
func (s *Service) TouchChannelAPIKeyUsed(keyID string) {
	if strings.TrimSpace(keyID) == "" {
		return
	}
	_ = s.repo.TouchChannelAPIKeyUsed(keyID, time.Now())
}

// AdminChannelAPIKeys 是 admin 查看渠道全部 Key 的入口（含 disabled）。
// 明文 Key 不返回，只带 APIKeySuffix 与 HasSecretKey。
func (s *Service) AdminChannelAPIKeys(actor *model.User, channelID string) ([]model.ChannelAPIKey, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	if _, err := s.repo.AdminSystemChannel(channelID); err != nil {
		return nil, err
	}
	keys, err := s.repo.ChannelAPIKeys(channelID, false)
	if err != nil {
		return nil, err
	}
	for i := range keys {
		keys[i].HasSecretKey = strings.TrimSpace(keys[i].SecretKey) != ""
	}
	return keys, nil
}

// SaveChannelAPIKey 是 admin 创建/编辑渠道 API Key 的入口。
// 校验：Label 非空且渠道内唯一；APIKey 非空（新建）或已有值（编辑）；
// 渠道下存在即梦协议模型时必须有 SecretKey；编辑不允许跨渠道改 ChannelID。
// Key 明文加密存储，返回视图只含 APIKeySuffix。
func (s *Service) SaveChannelAPIKey(actor *model.User, channelID string, id string, req ChannelAPIKeyRequest) (*model.ChannelAPIKey, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	if _, err := s.repo.AdminSystemChannel(channelID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, BadAuthRequest("系统渠道不存在或已删除")
		}
		return nil, err
	}
	label := strings.TrimSpace(req.Label)
	if label == "" {
		return nil, BadAuthRequest("请填写 Key 标签")
	}
	if len(label) > 80 {
		return nil, BadAuthRequest("Key 标签长度不能超过 80 字符")
	}
	priority := 100
	if req.Priority != nil {
		priority = *req.Priority
	}
	if priority < 0 || priority > 100000 {
		return nil, BadAuthRequest("Key 优先级必须是 0-100000 的整数")
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	item := &model.ChannelAPIKey{ID: newID(), ChannelID: channelID, Enabled: enabled, Priority: priority}
	if id != "" {
		existing, err := s.repo.ChannelAPIKeyByID(channelID, id)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, BadAuthRequest("API Key 不存在或不属于该渠道")
			}
			return nil, err
		}
		if err := s.decryptChannelAPIKeys([]model.ChannelAPIKey{*existing}); err != nil {
			return nil, err
		}
		item = existing
		item.UpdatedAt = time.Now()
	}
	// Label 渠道内唯一（含软删除排除，靠 DB 部分唯一索引兜底；这里先查给出友好错误）
	conflict, err := s.repo.ChannelAPIKeyByLabel(channelID, label)
	if err != nil {
		return nil, err
	}
	if conflict != nil && conflict.ID != item.ID {
		return nil, BadAuthRequest("该渠道已存在同名 Key 标签")
	}
	// 编辑时传空 Key 表示保留解密后的原值；新建时必须传，最终以非空为准
	if strings.TrimSpace(req.APIKey) != "" {
		item.APIKey = strings.TrimSpace(req.APIKey)
	}
	if strings.TrimSpace(item.APIKey) == "" {
		return nil, BadAuthRequest("请填写 API Key")
	}
	if strings.TrimSpace(req.SecretKey) != "" {
		item.SecretKey = strings.TrimSpace(req.SecretKey)
	}
	// 即梦协议需要 SecretKey 签名；渠道下挂即梦模型时未配 SecretKey 直接拒绝，不静默走空 Key
	if strings.TrimSpace(item.SecretKey) == "" && s.channelRequiresSecretKey(channelID) {
		return nil, BadAuthRequest("该渠道包含即梦协议模型，必须配置 Secret Key")
	}
	item.Label = label
	item.Enabled = enabled
	item.Priority = priority
	item.APIKeySuffix = channelAPIKeySuffix(item.APIKey)
	item.HasSecretKey = strings.TrimSpace(item.SecretKey) != ""
	if err := s.encryptChannelAPIKey(item); err != nil {
		return nil, err
	}
	if err := s.repo.SaveChannelAPIKey(item); err != nil {
		return nil, err
	}
	if req.Active && item.Enabled {
		if err := s.repo.UpdateChannelActiveAPIKey(channelID, item.ID); err != nil {
			return nil, err
		}
	}
	// 返回视图不含明文；HasSecretKey 在加密前已填充
	public := *item
	public.APIKey = ""
	public.SecretKey = ""
	return &public, nil
}

// DeleteChannelAPIKey 是 admin 删除渠道 Key 的入口。
// 删除的是当前生效 Key 时同步清除 ActiveAPIKeyID，回落到 priority 选择。
func (s *Service) DeleteChannelAPIKey(actor *model.User, channelID string, id string) error {
	if err := s.RequireAdmin(actor); err != nil {
		return err
	}
	channel, err := s.repo.AdminSystemChannel(channelID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return BadAuthRequest("系统渠道不存在或已删除")
		}
		return err
	}
	if err := s.repo.DeleteChannelAPIKey(channelID, id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return BadAuthRequest("API Key 不存在或不属于该渠道")
		}
		return err
	}
	if channel.ActiveAPIKeyID == id {
		return s.repo.UpdateChannelActiveAPIKey(channelID, "")
	}
	return nil
}

// SaveProjectChannelOverrides 是项目拥有者配置渠道覆盖的入口。
// 校验：capability ∈ {text,image,video,audio}；指向的渠道必须 enabled 且
// 属于系统或当前用户；渠道下需存在该 capability 的启用模型，避免覆盖到空渠道。
// 值为空字符串表示清除该能力的覆盖。
func (s *Service) SaveProjectChannelOverrides(userID string, projectID string, req ProjectChannelOverridesRequest) error {
	if _, err := s.repo.ProjectForUser(userID, projectID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return NotFound("项目不存在或不属于当前用户")
		}
		return err
	}
	cleaned := make(map[string]string, len(req.Overrides))
	for capability, channelID := range req.Overrides {
		if !channelOverrideCapabilities[capability] {
			return BadAuthRequest("渠道覆盖能力仅支持 text/image/video/audio")
		}
		channelID = strings.TrimSpace(channelID)
		if channelID == "" {
			continue // 空值 = 清除覆盖
		}
		if _, err := s.repo.ChannelForOverride(userID, channelID); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return BadAuthRequest("覆盖指向的渠道不存在或未启用")
			}
			return err
		}
		supported, err := s.channelSupportsCapability(channelID, capability)
		if err != nil {
			return err
		}
		if !supported {
			return BadAuthRequest("所选渠道不支持 " + capability + " 能力，请先在该渠道启用对应模型")
		}
		cleaned[capability] = channelID
	}
	var payload []byte
	if len(cleaned) > 0 {
		var marshalErr error
		payload, marshalErr = json.Marshal(cleaned)
		if marshalErr != nil {
			return marshalErr
		}
	}
	// 版本比较严格匹配：Version=0 只在 DB 当前也为 0（首次保存）时通过。
	// 前端第一次保存时传 version=0（useState 初始值），之后传后端返回的版本号。
	expectedVersion := req.Version
	if updateErr := s.repo.UpdateProjectChannelOverrides(userID, projectID, string(payload), expectedVersion); updateErr != nil {
		if errors.Is(updateErr, gorm.ErrRecordNotFound) {
			return BadAuthRequest("配置版本已过期，请刷新后重试")
		}
		return updateErr
	}
	return nil
}

// SetChannelActiveAPIKey 管理员在详情页把某条 Key 设为"生效 Key"。
// 若 keyID 为空会清除 active，回落到 priority 自动选择。
func (s *Service) SetChannelActiveAPIKey(actor *model.User, channelID string, keyID string) error {
	if err := s.RequireAdmin(actor); err != nil {
		return err
	}
	if _, err := s.repo.AdminSystemChannel(channelID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return BadAuthRequest("系统渠道不存在或已删除")
		}
		return err
	}
	keyID = strings.TrimSpace(keyID)
	if keyID == "" {
		return s.repo.UpdateChannelActiveAPIKey(channelID, "")
	}
	if _, err := s.repo.ChannelAPIKeyByID(channelID, keyID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return BadAuthRequest("API Key 不存在或不属于该渠道")
		}
		return err
	}
	return s.repo.UpdateChannelActiveAPIKey(channelID, keyID)
}

// ResetChannelAPIKeyFailures 管理员重置某把 Key 的失败计数与失败时间。
// 常见于人工更换了同标签下的明文或从上游平台解除封禁后。
func (s *Service) ResetChannelAPIKeyFailures(actor *model.User, channelID string, keyID string) error {
	if err := s.RequireAdmin(actor); err != nil {
		return err
	}
	if _, err := s.repo.AdminSystemChannel(channelID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return BadAuthRequest("系统渠道不存在或已删除")
		}
		return err
	}
	if _, err := s.repo.ChannelAPIKeyByID(channelID, keyID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return BadAuthRequest("API Key 不存在或不属于该渠道")
		}
		return err
	}
	return s.repo.ResetChannelAPIKeyFailures(channelID, keyID)
}

// ProjectChannelOverridesView 是返回给前端的视图：overrides 展开 + 当前版本号。
type ProjectChannelOverridesView struct {
	Overrides map[string]string `json:"overrides"`
	Version   int64             `json:"version"`
}

// GetProjectChannelOverrides 返回项目渠道覆盖视图；项目不存在或无权限时返回明确错误。
func (s *Service) GetProjectChannelOverrides(actor *model.User, projectID string) (*ProjectChannelOverridesView, error) {
	if actor == nil || strings.TrimSpace(actor.ID) == "" {
		return nil, Unauthorized("请先登录")
	}
	project, err := s.repo.ProjectForUser(actor.ID, projectID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, NotFound("项目不存在或不属于当前用户")
		}
		return nil, err
	}
	overrides := map[string]string{}
	if raw := strings.TrimSpace(project.ChannelOverridesJSON); raw != "" {
		if err := json.Unmarshal([]byte(raw), &overrides); err != nil {
			return nil, fmt.Errorf("项目渠道覆盖配置解析失败：%w", err)
		}
	}
	if overrides == nil {
		overrides = map[string]string{}
	}
	return &ProjectChannelOverridesView{Overrides: overrides, Version: project.ChannelOverrideVersion}, nil
}

// ProjectChannelOverrideOption 是项目设置页"供应商覆盖"的候选渠道视图。
type ProjectChannelOverrideOption struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Capabilities []string `json:"capabilities"`
}

// ProjectChannelOverrideOptions 列出当前用户可覆盖指向的渠道（系统渠道 + 自己的用户级渠道），
// 并附各渠道实际支持的 capability，供前端按能力渲染 Select。
func (s *Service) ProjectChannelOverrideOptions(userID string) ([]ProjectChannelOverrideOption, error) {
	channels, err := s.repo.OverrideEligibleChannels(userID)
	if err != nil {
		return nil, err
	}
	options := make([]ProjectChannelOverrideOption, 0, len(channels))
	for _, channel := range channels {
		items, err := s.repo.ChannelModels(channel.ID, false)
		if err != nil {
			return nil, err
		}
		capabilities := make([]string, 0, 4)
		seen := map[string]bool{}
		for _, item := range items {
			if item.Capability != "" && !seen[item.Capability] {
				seen[item.Capability] = true
				capabilities = append(capabilities, item.Capability)
			}
		}
		if len(capabilities) == 0 {
			continue // 没有启用模型的渠道无法被覆盖指向
		}
		options = append(options, ProjectChannelOverrideOption{ID: channel.ID, Name: channel.Name, Capabilities: capabilities})
	}
	return options, nil
}

// ProjectChannelOverrides 返回项目当前渠道覆盖配置与版本，供设置页回显。
func (s *Service) ProjectChannelOverrides(userID string, projectID string) (map[string]string, int64, error) {
	project, err := s.repo.ProjectForUser(userID, projectID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, 0, NotFound("项目不存在或不属于当前用户")
		}
		return nil, 0, err
	}
	overrides := map[string]string{}
	if strings.TrimSpace(project.ChannelOverridesJSON) != "" {
		if err := json.Unmarshal([]byte(project.ChannelOverridesJSON), &overrides); err != nil {
			return nil, 0, fmt.Errorf("项目渠道覆盖配置解析失败：%w", err)
		}
	}
	return overrides, project.ChannelOverrideVersion, nil
}

// channelRequiresSecretKey 判断渠道下是否挂了即梦协议模型（需要 SecretKey 签名）。
func (s *Service) channelRequiresSecretKey(channelID string) bool {
	items, err := s.repo.ChannelModels(channelID, true)
	if err != nil {
		return false // 查询失败时不阻断保存，由运行时兜底
	}
	for _, item := range items {
		if item.Protocol == model.ChannelInterfaceVolcengineJiMengImage || item.Protocol == model.ChannelInterfaceVolcengineJiMengVideo {
			return true
		}
	}
	return false
}

// channelSupportsCapability 判断渠道下是否存在该 capability 的启用模型。
func (s *Service) channelSupportsCapability(channelID string, capability string) (bool, error) {
	items, err := s.repo.ChannelModels(channelID, false)
	if err != nil {
		return false, err
	}
	for _, item := range items {
		if item.Capability == capability {
			return true, nil
		}
	}
	return false, nil
}

// channelAPIKeySuffix 取明文 Key 末 4 位供 UI 展示；超短 Key 原样返回。
func channelAPIKeySuffix(apiKey string) string {
	trimmed := strings.TrimSpace(apiKey)
	if len(trimmed) <= 4 {
		return trimmed
	}
	return trimmed[len(trimmed)-4:]
}

func (s *Service) encryptChannelAPIKey(key *model.ChannelAPIKey) error {
	apiKey, err := s.encryptSettingSecret(key.APIKey)
	if err != nil {
		return err
	}
	secretKey, err := s.encryptSettingSecret(key.SecretKey)
	if err != nil {
		return err
	}
	key.APIKey = apiKey
	key.SecretKey = secretKey
	return nil
}

func (s *Service) decryptChannelAPIKeys(keys []model.ChannelAPIKey) error {
	for i := range keys {
		apiKey, err := s.decryptSettingSecret(keys[i].APIKey)
		if err != nil {
			return err
		}
		secretKey, err := s.decryptSettingSecret(keys[i].SecretKey)
		if err != nil {
			return err
		}
		keys[i].APIKey = apiKey
		keys[i].SecretKey = secretKey
	}
	return nil
}
