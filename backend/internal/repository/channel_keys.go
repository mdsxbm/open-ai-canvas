package repository

import (
	"errors"
	"time"

	"infinite-canvas/backend/internal/model"

	"gorm.io/gorm"
)

// ChannelAPIKeys 返回渠道下的 API Key 子记录，按 priority 升序稳定排序。
// enabledOnly=false 时包含 disabled Key（admin 列表需要展示全部）。
func (r *Repository) ChannelAPIKeys(channelID string, enabledOnly bool) ([]model.ChannelAPIKey, error) {
	var keys []model.ChannelAPIKey
	query := r.db.Where("channel_id = ?", channelID)
	if enabledOnly {
		query = query.Where("enabled = ?", true)
	}
	err := query.Order("priority asc, created_at asc").Find(&keys).Error
	return keys, err
}

// ChannelAPIKeyByID 按 ID 取渠道下单把 Key；不存在或跨渠道返回 ErrRecordNotFound。
func (r *Repository) ChannelAPIKeyByID(channelID string, id string) (*model.ChannelAPIKey, error) {
	var key model.ChannelAPIKey
	if err := r.db.First(&key, "id = ? AND channel_id = ?", id, channelID).Error; err != nil {
		return nil, err
	}
	return &key, nil
}

// ChannelAPIKeyByLabel 按 Label 查渠道内 Key，供唯一性校验；找不到返回 nil, nil。
func (r *Repository) ChannelAPIKeyByLabel(channelID string, label string) (*model.ChannelAPIKey, error) {
	var key model.ChannelAPIKey
	err := r.db.First(&key, "channel_id = ? AND label = ?", channelID, label).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &key, nil
}

// ChannelForOverride 查项目覆盖可指向的渠道：enabled 且为系统渠道或当前用户的用户级渠道。
func (r *Repository) ChannelForOverride(userID string, channelID string) (*model.ModelChannel, error) {
	var channel model.ModelChannel
	err := r.db.First(&channel, "id = ? AND enabled = ? AND (scope = ? OR (scope = ? AND user_id = ?))",
		channelID, true, model.ChannelScopeSystem, model.ChannelScopeUser, userID).Error
	if err != nil {
		return nil, err
	}
	return &channel, nil
}

// OverrideEligibleChannels 列出项目覆盖可指向的全部渠道（enabled 且系统或本人用户级）。
func (r *Repository) OverrideEligibleChannels(userID string) ([]model.ModelChannel, error) {
	var channels []model.ModelChannel
	err := r.db.Where("enabled = ? AND (scope = ? OR (scope = ? AND user_id = ?))",
		true, model.ChannelScopeSystem, model.ChannelScopeUser, userID).
		Order("created_at asc").Find(&channels).Error
	return channels, err
}

// SaveChannelAPIKey upsert 一把渠道 Key；ID 必须由 service 层生成后传入。
func (r *Repository) SaveChannelAPIKey(key *model.ChannelAPIKey) error {
	if key.ID == "" {
		return gorm.ErrInvalidValue // 防御：ID 必须由 service 生成，不走 DB 自增
	}
	return r.db.Save(key).Error
}

// DeleteChannelAPIKey 软删除；仅当 Key 属于该渠道时生效。
func (r *Repository) DeleteChannelAPIKey(channelID string, id string) error {
	result := r.db.Where("id = ? AND channel_id = ?", id, channelID).Delete(&model.ChannelAPIKey{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// IncrementChannelAPIKeyFailure 递增失败计数并记录时间；不自动切换 Key。
func (r *Repository) IncrementChannelAPIKeyFailure(keyID string, at time.Time) error {
	return r.db.Model(&model.ChannelAPIKey{}).Where("id = ?", keyID).
		Updates(map[string]any{"failure_count": gorm.Expr("failure_count + 1"), "last_failed_at": at}).Error
}

// TouchChannelAPIKeyUsed 记录最近一次使用时间，供 admin 排查 Key 健康度。
func (r *Repository) TouchChannelAPIKeyUsed(keyID string, at time.Time) error {
	return r.db.Model(&model.ChannelAPIKey{}).Where("id = ?", keyID).
		Update("last_used_at", at).Error
}

// ResetChannelAPIKeyFailures 管理员清除 Key 的失败计数与时间。
func (r *Repository) ResetChannelAPIKeyFailures(channelID string, keyID string) error {
	return r.db.Model(&model.ChannelAPIKey{}).
		Where("id = ? AND channel_id = ?", keyID, channelID).
		Updates(map[string]any{"failure_count": 0, "last_failed_at": nil}).Error
}

// UpdateChannelActiveAPIKey 维护 ModelChannel.ActiveAPIKeyID 显式锁定关系。
// activeKeyID 传空表示清除锁定，回落到 priority 升序选择。
func (r *Repository) UpdateChannelActiveAPIKey(channelID string, activeKeyID string) error {
	result := r.db.Model(&model.ModelChannel{}).Where("id = ?", channelID).
		Updates(map[string]any{"active_api_key_id": activeKeyID, "updated_at": time.Now()})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// UpdateProjectChannelOverrides 保存项目级渠道覆盖配置并递增版本号。
// version 用乐观锁语义：仅当 DB 版本与传入 expectedVersion 一致时才写入，
// 并发编辑时后写方失败，避免静默覆盖他人配置。
func (r *Repository) UpdateProjectChannelOverrides(userID string, projectID string, overridesJSON string, expectedVersion int64) error {
	result := r.db.Model(&model.Project{}).
		Where("id = ? AND user_id = ? AND channel_override_version = ?", projectID, userID, expectedVersion).
		Updates(map[string]any{
			"channel_overrides_json":   overridesJSON,
			"channel_override_version": expectedVersion + 1,
			"updated_at":               time.Now(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
