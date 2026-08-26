package service

import (
	"testing"

	"infinite-canvas/backend/internal/model"
)

func TestNormalizeChannelModelContract(t *testing.T) {
	channel := &model.ModelChannel{APIKey: "test-key"}
	modelKey, providerModelKey, capability, protocol, err := normalizeChannelModelContract(channel, ChannelModelRequest{
		ModelKey: "models/gpt-test", Capability: "text", Protocol: string(model.ChannelInterfaceChatCompletion),
	})
	if err != nil {
		t.Fatalf("normalizeChannelModelContract() error = %v", err)
	}
	if modelKey != "gpt-test" || providerModelKey != "gpt-test" || capability != "text" || protocol != model.ChannelInterfaceChatCompletion {
		t.Fatalf("contract = %q, %q, %q, %q", modelKey, providerModelKey, capability, protocol)
	}
}

func TestNormalizeChannelModelContractPreservesProviderModelKey(t *testing.T) {
	channel := &model.ModelChannel{APIKey: "test-key"}
	modelKey, providerModelKey, _, _, err := normalizeChannelModelContract(channel, ChannelModelRequest{
		ModelKey: "seedance-2-5-480p", ProviderModelKey: "models/doubao-seedance-2-5", Capability: "video", Protocol: string(model.ChannelInterfaceVolcengineArkVideo),
	})
	if err != nil {
		t.Fatalf("normalizeChannelModelContract() error = %v", err)
	}
	if modelKey != "seedance-2-5-480p" || providerModelKey != "doubao-seedance-2-5" {
		t.Fatalf("contract = %q, %q", modelKey, providerModelKey)
	}
}

func TestNormalizeChannelModelContractRejectsCapabilityMismatch(t *testing.T) {
	channel := &model.ModelChannel{APIKey: "test-key"}
	_, _, _, _, err := normalizeChannelModelContract(channel, ChannelModelRequest{
		ModelKey: "image-test", Capability: "text", Protocol: string(model.ChannelInterfaceOpenAIImage),
	})
	if err == nil {
		t.Fatal("normalizeChannelModelContract() should reject a mismatched capability")
	}
}

func TestNormalizeChannelModelContractRequiresJiMengSecret(t *testing.T) {
	channel := &model.ModelChannel{APIKey: "access-key"}
	_, _, _, _, err := normalizeChannelModelContract(channel, ChannelModelRequest{
		ModelKey: "jimeng-test", Capability: "image", Protocol: string(model.ChannelInterfaceVolcengineJiMengImage),
	})
	if err == nil {
		t.Fatal("normalizeChannelModelContract() should require JiMeng credentials")
	}
}

func TestImageTestDefaultsUseModelCapability(t *testing.T) {
	tests := []struct {
		name        string
		profile     *ImageCapabilityConfig
		wantSize    string
		wantQuality string
	}{
		{name: "legacy fallback", wantSize: "1024x1024", wantQuality: "auto"},
		{
			name: "fixed 2k model",
			profile: &ImageCapabilityConfig{
				Size:    ImageSizeConfig{Parameter: "size", Default: "2048x2048"},
				Quality: ImageQualityConfig{Supported: false, Default: "auto"},
			},
			wantSize: "2048x2048",
		},
		{
			name: "provider selected size",
			profile: &ImageCapabilityConfig{
				Size:    ImageSizeConfig{Parameter: "none", Default: "auto"},
				Quality: ImageQualityConfig{Supported: false},
			},
		},
		{
			name: "gpt image capability",
			profile: &ImageCapabilityConfig{
				Size:    ImageSizeConfig{Parameter: "size", Default: "1024x1536"},
				Quality: ImageQualityConfig{Supported: true, Default: "high"},
			},
			wantSize: "1024x1536", wantQuality: "high",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			size, quality := imageTestDefaults(test.profile)
			if size != test.wantSize || quality != test.wantQuality {
				t.Fatalf("imageTestDefaults() = %q, %q; want %q, %q", size, quality, test.wantSize, test.wantQuality)
			}
		})
	}
}

// TestValidatePricingConfigRejectsNil 验证缺配置直接拒绝，不静默 fallback。
func TestValidatePricingConfigRejectsNil(t *testing.T) {
	if err := validatePricingConfig(nil); err == nil {
		t.Fatal("nil config should be rejected")
	}
}

// TestValidatePricingConfigRejectsEmptyFields 验证 bucketKeyFields 为空数组拒绝。
func TestValidatePricingConfigRejectsEmptyFields(t *testing.T) {
	err := validatePricingConfig(map[string]any{
		"buckets": map[string]any{"5_720p": float64(100_000)},
	})
	if err == nil {
		t.Fatal("empty bucketKeyFields should be rejected")
	}
}

// TestValidatePricingConfigRejectsInvalidFieldName 验证字段名非字符串/空字符串拒绝。
func TestValidatePricingConfigRejectsInvalidFieldName(t *testing.T) {
	cases := []map[string]any{
		{"bucketKeyFields": []any{123}, "buckets": map[string]any{"5_720p": float64(100_000)}},
		{"bucketKeyFields": []any{"  "}, "buckets": map[string]any{"5_720p": float64(100_000)}},
	}
	for index, config := range cases {
		if err := validatePricingConfig(config); err == nil {
			t.Fatalf("case %d invalid field name should be rejected", index)
		}
	}
}

// TestValidatePricingConfigRejectsDuplicateFields 验证字段名重复拒绝。
func TestValidatePricingConfigRejectsDuplicateFields(t *testing.T) {
	err := validatePricingConfig(map[string]any{
		"bucketKeyFields": []any{"duration", "duration"},
		"buckets":         map[string]any{"5_720p": float64(100_000)},
	})
	if err == nil {
		t.Fatal("duplicate field name should be rejected")
	}
}

// TestValidatePricingConfigRejectsEmptyBuckets 验证 buckets 为空拒绝。
func TestValidatePricingConfigRejectsEmptyBuckets(t *testing.T) {
	err := validatePricingConfig(map[string]any{
		"bucketKeyFields": []any{"duration"},
	})
	if err == nil {
		t.Fatal("empty buckets should be rejected")
	}
}

// TestValidatePricingConfigRejectsInvalidPrice 验证档位价格非法拒绝。
func TestValidatePricingConfigRejectsInvalidPrice(t *testing.T) {
	cases := []map[string]any{
		{"bucketKeyFields": []any{"duration"}, "buckets": map[string]any{"5_720p": float64(0)}},
		{"bucketKeyFields": []any{"duration"}, "buckets": map[string]any{"5_720p": float64(-1)}},
		{"bucketKeyFields": []any{"duration"}, "buckets": map[string]any{"5_720p": "invalid"}},
		{"bucketKeyFields": []any{"duration"}, "buckets": map[string]any{"5_720p": float64(100_000.5)}},
	}
	for index, config := range cases {
		if err := validatePricingConfig(config); err == nil {
			t.Fatalf("case %d invalid price should be rejected", index)
		}
	}
}

// TestValidatePricingConfigAcceptsValidConfig 验证合法配置通过校验。
func TestValidatePricingConfigAcceptsValidConfig(t *testing.T) {
	err := validatePricingConfig(map[string]any{
		"bucketKeyFields": []any{"duration", "resolution"},
		"buckets": map[string]any{
			"5_720p":   float64(100_000),
			"10_1080p": float64(200_000),
		},
	})
	if err != nil {
		t.Fatalf("valid config should pass, got error = %v", err)
	}
}

// TestValidatePricingConfigBoundsRejectsOverLimit 验证超过价格上限拒绝。
func TestValidatePricingConfigBoundsRejectsOverLimit(t *testing.T) {
	maxMicrocredits := int64(1_000_000) * CreditScale
	err := validatePricingConfigBounds(map[string]any{
		"buckets": map[string]any{"5_720p": float64(maxMicrocredits + 1)},
	}, maxMicrocredits)
	if err == nil {
		t.Fatal("over-limit price should be rejected")
	}
}

// TestNormalizePricingConfigCoercesInt64 验证 normalize 把 float64 档位价转回 int64，
// 避免后续 JSON 传输时不同 provider 精度差异。
func TestNormalizePricingConfigCoercesInt64(t *testing.T) {
	normalized, err := normalizePricingConfig(map[string]any{
		"bucketKeyFields": []any{"duration"},
		"buckets":         map[string]any{"5_720p": float64(100_000)},
	})
	if err != nil {
		t.Fatalf("normalize error = %v", err)
	}
	buckets, _ := normalized["buckets"].(map[string]any)
	price, ok := buckets["5_720p"].(int64)
	if !ok || price != 100_000 {
		t.Fatalf("normalized price = %v (type %T), want int64 100_000", buckets["5_720p"], buckets["5_720p"])
	}
	fields, _ := normalized["bucketKeyFields"].([]any)
	if len(fields) != 1 || fields[0] != "duration" {
		t.Fatalf("normalized fields = %v, want [duration]", fields)
	}
}

// TestToInt64PriceFloatTruncation 验证非整数 float64 拒绝，避免截断丢失精度。
func TestToInt64PriceFloatTruncation(t *testing.T) {
	if _, ok := toInt64Price(float64(100_000.5)); ok {
		t.Fatal("fractional float64 should be rejected")
	}
	v, ok := toInt64Price(float64(100_000))
	if !ok || v != 100_000 {
		t.Fatalf("integral float64 = %d, ok = %v", v, ok)
	}
}
