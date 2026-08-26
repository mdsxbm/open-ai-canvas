# 规格文档：渠道多 API Key + 项目级供应商覆盖

> 产物所属 Spec 目录：`.trae/specs/channel-multi-key-and-project-scope/`
> 自然语言：中文
> 关联仓库：影策 AI 影视创作工作台（`backend/` Go + `web/` React 19）
> 阶段定位：多模型 + 计费重构的第 3 阶段，建立渠道级多 API Key 与项目级供应商覆盖能力。
> 前置：阶段 1（commit 99a0042）+ 阶段 2（PricingConfigJSON + per_video_bucket）已完成。

---

## 0. 背景与目标

### 0.1 用户诉求
用户要求「像 ArcReel 项目一样支持官方 API Key 配置」。ArcReel 把"供应商"作为一等公民：
- **多 API Key 切换**：同一供应商可配多把 Key，按优先级/手动激活选择，单把 Key 失败可降级到下一把；
- **项目级供应商覆盖**：不同项目可指定不同供应商，覆盖系统默认。

### 0.2 影策现状（已核对 2026-08）

| 能力 | 状态 | 位置 |
|---|---|---|
| 自定义供应商 | ✅ 已覆盖 | `ModelChannel` 有 `Name`/`BaseURL`/`APIKey`/`SecretKey`/`APIFormat`/`ModelsJSON`/`HeadersJSON`，`Scope`（system/user）区分系统级与用户级 |
| Project 实体 | ✅ 已存在 | [models_project.go:113-127](file:///workspace/backend/internal/model/models_project.go#L113-L127) `Project{ID, UserID, Name, StylePresetID, StyleProfileJSON, ...}` |
| Project 级配置覆盖路径 | ✅ 已存在 | [provider.go:317-342](file:///workspace/backend/internal/service/provider.go#L317-L342) `taskProjectStyleProfile`：canvas→`CanvasProject.projectID`→`Project`→读 project 级配置 |
| 多 API Key 切换 | ❌ 未覆盖 | `ModelChannel.APIKey`/`SecretKey` 是单值，同一供应商只能配一把 Key |
| 项目级供应商覆盖 | ❌ 未覆盖 | 渠道是全局的，无法按 project 指定不同供应商 |

### 0.3 目标
**在不破坏现有渠道合同的前提下，引入渠道级多 API Key 与项目级供应商覆盖，复用现有 `taskProjectStyleProfile` 覆盖路径模式。**

具体交付：
1. 新增 `ChannelAPIKey` 子表，`ModelChannel.APIKey`/`SecretKey` 保留为兼容回退；
2. 多 Key 选择策略：**priority + manual active**（简单可预测，不做自动 round-robin，避免计费归属混乱）；
3. Key 失败处理：标记 `last_failed_at` + `failure_count`，不自动切换，由管理员手动介入；
4. `Project` 加 `ChannelOverridesJSON` 字段（仿 `StyleProfileJSON` 模式），存按能力→channelID 的覆盖映射；
5. 生成任务时渠道解析：先查 project override → fallback 到系统/用户默认渠道；
6. 前端：管理员渠道编辑 Drawer 加多 Key 列表；项目设置页加"供应商覆盖"配置区。

### 0.4 非目标
- **不做 Key 自动轮询/round-robin**：避免一把 Key 失败后悄悄切到另一把、把成本算到意想不到的账户上；只标记 + 提示管理员；
- **不删 `ModelChannel.APIKey`/`SecretKey` 字段**：保留作兼容回退，旧渠道默认有一把"主 Key"，零迁移；
- **不做项目级模型定价覆盖**：定价仍按渠道模型走，项目只覆盖"用哪个渠道"；
- **不做团队/组织级渠道共享**：覆盖粒度只到 user-scope + project-scope，不做 org-scope；
- **不引入新 BillingMode**：渠道选择与计费形状正交，多 Key 不影响 `per_video_bucket` 等计费路径；
- **不与阶段 2 的 `per_video_bucket` 混做**：单独立 spec，独立 commit。

---

## 1. 现状代码地图

### 1.1 后端数据模型
- [models_channel.go:8-25](file:///workspace/backend/internal/model/models_channel.go#L8-L25) `ModelChannel`：`APIKey`/`SecretKey` 单值字段。
- [models_channel.go:27-54](file:///workspace/backend/internal/model/models_channel.go#L27-L54) `ChannelModel`：渠道下挂载的模型。
- [models_project.go:113-127](file:///workspace/backend/internal/model/models_project.go#L113-L127) `Project`：含 `StyleProfileJSON` 模式参考。
- [models_project.go:233-244](file:///workspace/backend/internal/model/models_project.go#L233-L244) `CanvasProject`：`ProjectID` 字段把画布归属到 project。

### 1.2 后端渠道解析与覆盖
- [service/provider.go:268-315](file:///workspace/backend/internal/service/provider.go#L268-L315) `applyGenerationStyleProfile`：生成时应用 project 级配置，是项目级覆盖的现成模式参考。
- [service/provider.go:317-342](file:///workspace/backend/internal/service/provider.go#L317-L342) `taskProjectStyleProfile`：canvas→project 查找路径，本 spec 复用此模式实现渠道覆盖。
- [service/channel_models.go:138-271](file:///workspace/backend/internal/service/channel_models.go#L138-L271) `SaveAdminChannelModel`：渠道模型保存与校验。
- [web/src/services/api/custom-channel-relay.ts:12-39](file:///workspace/web/src/services/api/custom-channel-relay.ts#L12-L39) `channelRequest`：系统代理直连 vs 自定义渠道中转的分流。

### 1.3 前端
- [pages/admin/channels/channels-page.tsx](file:///workspace/web/src/pages/admin/channels/channels-page.tsx) 系统渠道列表与编辑。
- [pages/admin/components/channel-model-manager.tsx](file:///workspace/web/src/pages/admin/components/channel-model-manager.tsx) 渠道模型管理。
- [services/api/auth.ts:417-429](file:///workspace/web/src/services/api/auth.ts#L417-L429) `listAdminChannels`/`createAdminChannel` 等渠道 API。
- [services/api/wallet.ts:257-278](file:///workspace/web/src/services/api/wallet.ts#L257-L278) `listAdminChannelModels` 等模型 API。

---

## 2. 目标结构

### 2.1 后端数据模型扩展

#### 2.1.1 新增 `ChannelAPIKey` 子表

[models_channel.go](file:///workspace/backend/internal/model/models_channel.go) 新增模型：

```go
// ChannelAPIKey 是渠道的多 API Key 子记录。
// ModelChannel.APIKey/SecretKey 保留为兼容回退：旧渠道默认有一把"主 Key"，
// 升级后 admin 可逐步把主 Key 迁到子表，旧字段不删，零迁移。
// 选择策略：priority 升序 + enabled 过滤 + active_key_id 显式锁定；
// 不做 round-robin，避免计费归属混乱。
type ChannelAPIKey struct {
    ID            string         `json:"id" gorm:"primaryKey;size:36"`
    ChannelID     string         `json:"channelId" gorm:"index;size:36;uniqueIndex:idx_channel_api_key_label,priority:1,where:deleted_at IS NULL"`
    Label         string         `json:"label" gorm:"size:80;uniqueIndex:idx_channel_api_key_label,priority:2,where:deleted_at IS NULL"`
    APIKey        string         `json:"-" gorm:"type:text"`
    APIKeySuffix  string         `json:"apiKeySuffix" gorm:"size:16"`  // 末 4 位，供 UI 展示
    SecretKey     string         `json:"-" gorm:"type:text"`           // 即梦等需要 secret 的协议
    HasSecretKey  bool           `json:"hasSecretKey" gorm:"-"`
    Enabled       bool           `json:"enabled" gorm:"index"`
    Priority      int            `json:"priority" gorm:"default:100"`  // 升序，越小越优先
    FailureCount  int            `json:"failureCount"`
    LastFailedAt  *time.Time     `json:"lastFailedAt,omitempty"`
    LastUsedAt    *time.Time     `json:"lastUsedAt,omitempty"`
    CreatedAt     time.Time      `json:"createdAt"`
    UpdatedAt     time.Time      `json:"updatedAt"`
    DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`
}
```

`ModelChannel` 加字段：
```go
type ModelChannel struct {
    // ... 现有字段不变
    ActiveAPIKeyID string `json:"activeApiKeyId,omitempty" gorm:"size:36;index"`
    // ... APIKey/SecretKey 保留作兼容回退
}
```

`ActiveAPIKeyID` 为空时按 priority 升序选第一把 enabled key；非空时锁定该 key（除非该 key disabled）。

#### 2.1.2 `Project` 加 `ChannelOverridesJSON`

[models_project.go](file:///workspace/backend/internal/model/models_project.go) `Project` 加字段：

```go
type Project struct {
    // ... 现有字段不变
    // ChannelOverridesJSON 存按能力→channelID 的覆盖映射，仿 StyleProfileJSON 模式。
    // 形如：{"video":"ch_xxx","image":"ch_yyy"}；缺省能力走默认渠道解析。
    ChannelOverridesJSON string `json:"channelOverridesJson,omitempty" gorm:"type:text"`
    ChannelOverrides     map[string]string `json:"channelOverrides,omitempty" gorm:"-"`
    ChannelOverrideVersion int64           `json:"channelOverrideVersion"`
}
```

内存字段 `ChannelOverrides` 与 `ChannelOverridesJSON` 的反序列化/序列化路径仿 `CapabilityConfig`/`PricingConfig` 模式。

### 2.2 多 API Key 选择与失败处理

[service/channel_keys.go](file:///workspace/backend/internal/service/channel_keys.go)（新建）：

```go
// ResolveChannelAPIKey 按 ActiveAPIKeyID + priority + enabled 选出当前生效的 API Key。
// 旧渠道（无子表记录）回退到 ModelChannel.APIKey/SecretKey，零迁移兼容。
// 选不到返回 error，不静默用空 Key 走请求，避免免费生成或鉴权失败循环。
func (s *Service) ResolveChannelAPIKey(channel *model.ModelChannel) (apiKey, secretKey string, keyID string, err error) {
    keys, err := s.repo.ChannelAPIKeys(channel.ID, true)
    if err != nil {
        return "", "", "", err
    }
    // 兼容回退：无子表记录时用旧字段
    if len(keys) == 0 {
        if strings.TrimSpace(channel.APIKey) == "" {
            return "", "", "", errors.New("渠道未配置 API Key")
        }
        return channel.APIKey, channel.SecretKey, "", nil
    }
    // 显式 active 优先
    if channel.ActiveAPIKeyID != "" {
        for _, k := range keys {
            if k.ID == channel.ActiveAPIKeyID && k.Enabled {
                return k.APIKey, k.SecretKey, k.ID, nil
            }
        }
        // active key disabled/不存在 → 走 priority fallback，不静默失败
    }
    // priority 升序选第一把 enabled
    sort.SliceStable(keys, func(i, j int) bool { return keys[i].Priority < keys[j].Priority })
    for _, k := range keys {
        if k.Enabled {
            return k.APIKey, k.SecretKey, k.ID, nil
        }
    }
    return "", "", "", errors.New("渠道无可用 API Key，请在管理后台启用至少一把 Key")
}

// MarkChannelAPIKeyFailure 标记某把 Key 失败，不自动切换。
// 计费渠道错误（401/403/429）才标记；网络错误不标记（避免误伤）。
// 标记后管理员收到通知，手动决定是否切到下一把。
func (s *Service) MarkChannelAPIKeyFailure(keyID string) error {
    if strings.TrimSpace(keyID) == "" {
        return nil  // 旧渠道回退路径，无 keyID
    }
    return s.repo.IncrementChannelAPIKeyFailure(keyID, time.Now())
}
```

### 2.3 项目级供应商覆盖解析

[service/provider.go](file:///workspace/backend/internal/service/provider.go) 新增：

```go
// resolveProjectChannelOverride 按 taskProjectID 查 project 级渠道覆盖，
// 复用 taskProjectStyleProfile 的 canvas→project 查找路径。
// 返回的 channelID 为空表示无覆盖，调用方走默认渠道解析。
func (s *Service) resolveProjectChannelOverride(userID string, canvasOrProjectID string, capability string) (string, error) {
    id := strings.TrimSpace(canvasOrProjectID)
    if id == "" {
        return "", nil
    }
    project, err := s.lookupTaskProject(userID, id)
    if err != nil || project == nil {
        return "", err
    }
    if strings.TrimSpace(project.ChannelOverridesJSON) == "" {
        return "", nil
    }
    var overrides map[string]string
    if err := json.Unmarshal([]byte(project.ChannelOverridesJSON), &overrides); err != nil {
        return "", fmt.Errorf("项目渠道覆盖配置解析失败：%w", err)
    }
    return overrides[capability], nil
}

// lookupTaskProject 复用 taskProjectStyleProfile 的查找逻辑，抽出供多场景复用。
func (s *Service) lookupTaskProject(userID string, canvasOrProjectID string) (*model.Project, error) {
    // ... 与 taskProjectStyleProfile 同样的 canvas→projectID→project 查找路径
}
```

`taskProjectStyleProfile` 改调 `lookupTaskProject`，保持现有画风覆盖行为不变。

### 2.4 渠道解析主流程改造

[service/provider.go](file:///workspace/backend/internal/service/provider.go) 渠道解析入口（生成任务时）：

```go
// 1. 优先查 project override
overrideChannelID, err := s.resolveProjectChannelOverride(userID, taskProjectID, capability)
if err != nil {
    return err
}
// 2. 有 override 用 override；否则走系统/用户默认渠道解析
channel, err := s.selectChannel(actor, capability, overrideChannelID)
if err != nil {
    return err
}
// 3. 从选中渠道解析 API Key（多 Key 或兼容回退）
apiKey, secretKey, keyID, err := s.ResolveChannelAPIKey(channel)
if err != nil {
    return err
}
// 4. 执行请求；401/403/429 时 MarkChannelAPIKeyFailure(keyID) + 返回明确错误
```

### 2.5 校验与权限

[service/channel_keys.go](file:///workspace/backend/internal/service/channel_keys.go)（续）：

```go
// SaveChannelAPIKey 是 admin 创建/编辑渠道 API Key 的入口。
// 校验：Label 非空且渠道内唯一；APIKey 非空；即梦协议必须有 SecretKey；
// 不允许跨渠道改 ChannelID；Enabled + Priority 合法。
// APIKey 写入后只暴露 APIKeySuffix，明文 Key 不返回前端。
func (s *Service) SaveChannelAPIKey(actor *model.User, channelID string, id string, req ChannelAPIKeyRequest) (*model.ChannelAPIKey, error) {
    if err := s.RequireAdmin(actor); err != nil {
        return nil, err
    }
    channel, err := s.repo.AdminSystemChannel(channelID)
    if err != nil {
        return nil, err
    }
    // ... 校验 + 保存 + APIKeySuffix 截取
}

// SaveProjectChannelOverrides 是项目拥有者配置渠道覆盖的入口。
// 校验：每个 capability 只能指向用户拥有的 user-scope 渠道或系统渠道；
// capability ∈ {text,image,video,audio}；channelID 必须存在且 capability 匹配。
func (s *Service) SaveProjectChannelOverrides(userID string, projectID string, overrides map[string]string) error {
    // ... 鉴权 + 校验 + 序列化 + ChannelOverrideVersion++
}
```

### 2.6 前端类型扩展

[services/api/channels.ts](file:///workspace/web/src/services/api/) `ChannelAPIKey` 类型：

```typescript
export type ChannelAPIKey = {
    id: string;
    channelId: string;
    label: string;
    apiKeySuffix: string;       // 末 4 位，明文 Key 不返回
    hasSecretKey: boolean;
    enabled: boolean;
    priority: number;
    failureCount: number;
    lastFailedAt?: string;
    lastUsedAt?: string;
    createdAt: string;
    updatedAt: string;
};

export type ModelChannel = {
    // ... 现有字段不变
    activeApiKeyId?: string;
    apiKeys?: ChannelAPIKey[];   // 列表展开时附带
};
```

`Project` 类型加 `channelOverrides` / `channelOverrideVersion`。

### 2.7 前端 UI 扩展

#### 2.7.1 管理员渠道编辑 Drawer 加多 Key 列表

[pages/admin/channels/channels-page.tsx](file:///workspace/web/src/pages/admin/channels/channels-page.tsx) 渠道编辑 Drawer：

```tsx
<Form.List name="apiKeys">
    {(fields, { add, remove }) => (
        <Table dataSource={fields.map(f => form.getFieldValue(["apiKeys", f.name]))}>
            {/* 列：Label / 末4位Key / 优先级 / 启用 / 失败次数 / 操作 */}
            {/* 新增 Key 行：Label + APIKey + SecretKey（即梦） + Priority */}
            {/* 删除时二次确认，避免误删导致渠道不可用 */}
        </Table>
    )}
</Form.List>
{/* 设为默认（写 ModelChannel.ActiveAPIKeyID）单独按钮，与 enabled 切换分离 */}
```

#### 2.7.2 项目设置加"供应商覆盖"区

[pages/project/](file:///workspace/web/src/pages/project/)（项目设置页）：

```tsx
{/* 按能力列：text/image/video/audio，每能力一个 Select 选 user-scope 或系统渠道 */}
{["text","image","video","audio"].map(capability => (
    <Form.Item label={`${capabilityLabel} 渠道覆盖`}>
        <Select
            allowClear
            options={availableChannelsForCapability(capability)}
            placeholder="未覆盖时使用默认渠道"
        />
    </Form.Item>
))}
{/* 校验：选中的渠道 capability 必须匹配，避免 image 任务覆盖到 text 渠道 */}
```

---

## 3. 兼容性与迁移

| 场景 | 处理 |
|---|---|
| 旧渠道（无 ChannelAPIKey 子表记录） | `ResolveChannelAPIKey` 回退到 `ModelChannel.APIKey`/`SecretKey`，行为不变 |
| 旧渠道迁移到多 Key | admin 在 UI 把主 Key 录入为子表记录，旧字段保留作 fallback，可不删 |
| 旧 project（无 ChannelOverridesJSON） | 字段为空，无覆盖，走默认渠道解析，行为不变 |
| DB 迁移 | GORM AutoMigrate 自动加 `ChannelAPIKey` 表 + `ModelChannel.ActiveAPIKeyID` 列 + `Project.ChannelOverridesJSON` 列，旧行新列为空 |
| 前端旧数据 | `apiKeys` undefined，`channelOverrides` undefined，UI 显示单 Key 兼容模式 |
| 即梦协议 | 子表 `SecretKey` 字段单独校验，未配则拒绝保存 |

---

## 4. 验证方式

### 4.1 后端单元测试
- `service/channel_keys_test.go`（新建）：
  - `ResolveChannelAPIKey`：旧渠道回退、active 显式锁定、priority fallback、全部 disabled 报错、空渠道报错；
  - `MarkChannelAPIKeyFailure`：空 keyID 跳过、正常递增 failure_count + 更新 last_failed_at；
  - `SaveChannelAPIKey`：Label 非空/唯一、APIKey 非空、即梦必须有 SecretKey、跨渠道改 ChannelID 拒绝；
  - `SaveProjectChannelOverrides`：capability 合法、channelID 归属与能力匹配、覆盖指向他人渠道拒绝。
- `service/provider_test.go`（如已存在则补 case）：
  - `resolveProjectChannelOverride`：canvas→project 路径、无覆盖返回空、JSON 解析失败报错；
  - 渠道解析主流程：override 优先、override 不存在走默认、override channelID 不属于用户拒绝。
- 现有 `taskProjectStyleProfile` 测试保持通过（行为不变，只是抽出 `lookupTaskProject` 复用）。

### 4.2 前端
- `web/` 跑 `bun run typecheck` 确认类型无报错。
- 不启动 dev server（按 AGENTS.md §9，用户未要求浏览器预览）。

### 4.3 不运行的验证
- 不跑 build、不跑 lint、不启动 dev server；
- 交付时明确说明未运行验证，由用户决定何时跑。

---

## 5. 风险与回滚

### 5.1 风险
- **多 Key 计费归属混乱**：本 spec 明确不做自动 round-robin，priority + manual active 策略保证每把 Key 用途可追溯；失败只标记不切换，管理员手动介入。
- **Key 明文泄露**：APIKey 写入后不返回前端，只暴露 `APIKeySuffix`（末 4 位）；与现有 `ModelChannel.APIKey` `json:"-"` 处理一致。
- **项目覆盖指向不存在的渠道**：保存时校验渠道归属与能力匹配；运行时再校验一次，找不到则走默认 + 记录 warning，不静默失败。
- **覆盖路径与画风路径冲突**：两者都基于 `taskProjectStyleProfile` 模式，本 spec 抽出 `lookupTaskProject` 共用，不改变画风路径行为。
- **即梦协议 SecretKey 缺失**：子表保存时按 `normalizeChannelModelContract` 同款校验，未配 SecretKey 直接拒绝，不静默走空 Key。

### 5.2 回滚
- 表结构变更可回滚（DROP COLUMN / DROP TABLE，SQLite 需重建表）；
- 代码回滚 = `git revert` 单次 commit；
- 建议作为一个 commit 提交，便于回滚；
- 旧渠道路径完全保留，回滚后旧渠道立即恢复单 Key 行为。

---

## 6. 交付清单

### 后端
- [ ] `internal/model/models_channel.go`：新增 `ChannelAPIKey` 模型；`ModelChannel` 加 `ActiveAPIKeyID` 字段。
- [ ] `internal/model/models_project.go`：`Project` 加 `ChannelOverridesJSON`/`ChannelOverrides`/`ChannelOverrideVersion` 三字段。
- [ ] `internal/repository/channel_keys.go`（新建）：`ChannelAPIKeys`/`SaveChannelAPIKey`/`DeleteChannelAPIKey`/`IncrementChannelAPIKeyFailure`/`TouchChannelAPIKeyUsed` 等。
- [ ] `internal/repository/repository.go`：补 `Project` 字段读写 + `lookupTaskProject` 抽出。
- [ ] `internal/service/channel_keys.go`（新建）：`ResolveChannelAPIKey`/`MarkChannelAPIKeyFailure`/`SaveChannelAPIKey`/`SaveProjectChannelOverrides` + 校验。
- [ ] `internal/service/provider.go`：抽出 `lookupTaskProject`；新增 `resolveProjectChannelOverride`；改造渠道解析主流程先查 override。
- [ ] `internal/handler/channel_keys.go`（新建）：`POST/PUT/DELETE /api/admin/channels/:id/keys`、`PUT /api/projects/:id/channel-overrides` 路由。
- [ ] `internal/service/channel_keys_test.go`（新建）：覆盖 `ResolveChannelAPIKey`/`MarkChannelAPIKeyFailure`/`SaveChannelAPIKey`/`SaveProjectChannelOverrides` 全路径。
- [ ] `internal/service/provider_test.go`（新建或补 case）：`resolveProjectChannelOverride` 与渠道解析主流程 case。

### 前端
- [ ] `services/api/channels.ts`：新增 `ChannelAPIKey` 类型；`ModelChannel` 加 `activeApiKeyId`/`apiKeys`；`Project` 加 `channelOverrides`/`channelOverrideVersion`。
- [ ] `pages/admin/channels/channels-page.tsx`：渠道编辑 Drawer 加 `Form.List` 多 Key 表格（Label/末4位Key/优先级/启用/失败次数/操作）+ "设为默认"按钮。
- [ ] `pages/project/`（项目设置页）：加"供应商覆盖"区，按能力 Select 渠道，校验 capability 匹配。
- [ ] `services/api/`：补 `listChannelAPIKeys`/`createChannelAPIKey`/`updateChannelAPIKey`/`deleteChannelAPIKey`/`saveProjectChannelOverrides` API 封装。

### 文档与流程
- [ ] `CHANGELOG.md` Unreleased 更新。
- [ ] 单次 commit 提交。
- [ ] 交付说明未运行验证。
- [ ] 同步 `docs/content/docs/backend/backend-database.mdx`：新增 `ChannelAPIKey` 表 + `Project.ChannelOverridesJSON` 列。

---

## 7. 与阶段 2 的关系

| 维度 | 阶段 2（per_video_bucket） | 阶段 3（多 Key + 项目覆盖） |
|---|---|---|
| 关注点 | 计费形状（怎么算钱） | 渠道选择（用哪把 Key/哪个供应商） |
| 数据表 | `ChannelModel.PricingConfigJSON` | `ChannelAPIKey` 子表 + `Project.ChannelOverridesJSON` |
| 触发时机 | `newBillingOrder` 创建订单时 | 生成任务前渠道解析时 |
| 是否正交 | ✅ 完全正交 | ✅ 完全正交 |
| 是否混做 | ❌ 单独立 spec | ✅ 本 spec |

阶段 3 不改阶段 2 的计费路径：渠道选择解析出 `apiKey` + `channelID` 后，`newBillingOrder` 仍按 `item.BillingMode`（含 `per_video_bucket`）算价，互不影响。

---

## 8. 实施顺序建议

按依赖顺序分小步推进，每步可独立验证：

1. **数据模型**：`ChannelAPIKey` 表 + `ModelChannel.ActiveAPIKeyID` + `Project.ChannelOverridesJSON`（GORM AutoMigrate 即可）；
2. **Repo 层**：`ChannelAPIKey` CRUD + `Project` 字段读写；
3. **Service 层**：`ResolveChannelAPIKey` + `MarkChannelAPIKeyFailure` + `SaveChannelAPIKey` + `SaveProjectChannelOverrides` + 校验；
4. **Provider 层**：抽出 `lookupTaskProject` + `resolveProjectChannelOverride` + 改造渠道解析主流程；
5. **Handler 层**：`/api/admin/channels/:id/keys` + `/api/projects/:id/channel-overrides` 路由；
6. **前端类型**：`ChannelAPIKey` + `ModelChannel.activeApiKeyId/apiKeys` + `Project.channelOverrides`；
7. **前端 UI**：渠道编辑 Drawer 多 Key 表 + 项目设置"供应商覆盖"区；
8. **测试**：后端单元测试 + 前端 typecheck；
9. **文档与提交**：CHANGELOG + backend-database.mdx + 单次 commit。

每步独立 commit 也可，但建议合并为单次 commit 便于回滚（与阶段 1/2 一致）。
