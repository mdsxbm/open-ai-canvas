package service

import (
	"errors"
	"strings"
	"testing"
)

// TestResolveVideoBucketKeyVolcengineStyle 验证火山方舟式 payload（config.videoSeconds + config.vquality）。
// bucketKeyFields=["videoSeconds","vquality"]，期望拼成 "5_720"。
func TestResolveVideoBucketKeyVolcengineStyle(t *testing.T) {
	pricing := map[string]any{
		"bucketKeyFields": []any{"videoSeconds", "vquality"},
		"buckets":         map[string]any{"5_720": float64(100_000)},
	}
	payload := map[string]any{
		"config": map[string]any{
			"videoSeconds": "5",
			"vquality":     "720",
		},
	}
	key, err := resolveVideoBucketKey(pricing, payload)
	if err != nil {
		t.Fatalf("resolve error = %v", err)
	}
	if key != "5_720" {
		t.Fatalf("bucket key = %q, want 5_720", key)
	}
}

// TestResolveVideoBucketKeyTopLevelDuration 验证即梦式 payload（顶层 duration）。
// bucketKeyFields=["duration"]，期望 "5"。
func TestResolveVideoBucketKeyTopLevelDuration(t *testing.T) {
	pricing := map[string]any{
		"bucketKeyFields": []any{"duration"},
		"buckets":         map[string]any{"5": float64(50_000)},
	}
	payload := map[string]any{
		"duration": 5,
		"prompt":   "irrelevant",
	}
	key, err := resolveVideoBucketKey(pricing, payload)
	if err != nil {
		t.Fatalf("resolve error = %v", err)
	}
	if key != "5" {
		t.Fatalf("bucket key = %q, want 5", key)
	}
}

// TestResolveVideoBucketKeyMissingField 验证字段提取失败返回明确 error。
// 不静默用空串，避免免费生成。
func TestResolveVideoBucketKeyMissingField(t *testing.T) {
	pricing := map[string]any{
		"bucketKeyFields": []any{"duration", "resolution"},
		"buckets":         map[string]any{"5_720p": float64(100_000)},
	}
	payload := map[string]any{
		"duration": "5",
		// resolution 缺失
	}
	_, err := resolveVideoBucketKey(pricing, payload)
	if err == nil {
		t.Fatal("missing field should error")
	}
	if !strings.Contains(err.Error(), "resolution") {
		t.Fatalf("error should mention missing field name, got %q", err.Error())
	}
}

// TestResolveVideoBucketKeyNilConfig 验证缺配置返回 error。
func TestResolveVideoBucketKeyNilConfig(t *testing.T) {
	_, err := resolveVideoBucketKey(nil, map[string]any{"duration": "5"})
	if err == nil {
		t.Fatal("nil pricing config should error")
	}
}

// TestResolveVideoBucketKeyInvalidFieldName 验证字段名非字符串返回 error。
func TestResolveVideoBucketKeyInvalidFieldName(t *testing.T) {
	pricing := map[string]any{
		"bucketKeyFields": []any{123},
		"buckets":         map[string]any{"5": float64(100_000)},
	}
	_, err := resolveVideoBucketKey(pricing, map[string]any{"duration": "5"})
	if err == nil {
		t.Fatal("non-string field name should error")
	}
}

// TestExtractPayloadFieldNestedConfig 验证 config.<field> 优先级。
// 火山方舟 payload 把字段嵌套在 config 里，应从 config 取值。
func TestExtractPayloadFieldNestedConfig(t *testing.T) {
	payload := map[string]any{
		"config": map[string]any{
			"videoSeconds": "10",
		},
		"videoSeconds": "999", // 顶层同名干扰，应被忽略
	}
	if v := extractPayloadField(payload, "videoSeconds"); v != "10" {
		t.Fatalf("nested config field = %q, want 10", v)
	}
}

// TestExtractPayloadFieldTopLevel 验证顶层裸字段 fallback。
func TestExtractPayloadFieldTopLevel(t *testing.T) {
	payload := map[string]any{
		"duration": 15,
		"prompt":   "irrelevant",
	}
	if v := extractPayloadField(payload, "duration"); v != "15" {
		t.Fatalf("top-level field = %q, want 15", v)
	}
}

// TestExtractPayloadFieldMissing 验证字段不存在返回空串。
func TestExtractPayloadFieldMissing(t *testing.T) {
	if v := extractPayloadField(map[string]any{"prompt": "x"}, "duration"); v != "" {
		t.Fatalf("missing field should return empty, got %q", v)
	}
}

// TestExtractPayloadFieldNilPayload 验证 nil payload 不 panic。
func TestExtractPayloadFieldNilPayload(t *testing.T) {
	if v := extractPayloadField(nil, "duration"); v != "" {
		t.Fatalf("nil payload should return empty, got %q", v)
	}
	// 同时验证 resolveVideoBucketKey 不会因 nil payload panic
	_, err := resolveVideoBucketKey(map[string]any{"bucketKeyFields": []any{"duration"}}, nil)
	if err == nil {
		t.Fatal("nil payload should error on missing field")
	}
	if !errors.Is(err, err) {
		t.Fatalf("error type check: %v", err)
	}
}
