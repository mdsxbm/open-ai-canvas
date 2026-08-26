package billing

import (
	"testing"
)

// TestCalculateCostFixedRequest 验证按次计费：金额 = unitPrice × 1 × multiplierBPS/10000 向上取整。
func TestCalculateCostFixedRequest(t *testing.T) {
	// 100_000 × 1 × 10000/10000 = 100_000
	amount, err := CalculateCost(PricingParams{
		BillingMode: ModeFixedRequest, UnitPrice: 100_000, MultiplierBPS: 10_000,
	})
	if err != nil || amount != 100_000 {
		t.Fatalf("fixed_request = %d, err = %v", amount, err)
	}
	// 倍率 15000（1.5 倍）：100_000 × 15000 / 10000 = 150_000
	amount, err = CalculateCost(PricingParams{
		BillingMode: ModeFixedRequest, UnitPrice: 100_000, MultiplierBPS: 15_000,
	})
	if err != nil || amount != 150_000 {
		t.Fatalf("fixed_request with 1.5x = %d, err = %v", amount, err)
	}
}

// TestCalculateCostPerSecond 验证按秒计费：金额 = unitPrice × duration × multiplierBPS/10000 向上取整。
func TestCalculateCostPerSecond(t *testing.T) {
	// 50_000 × 5 秒 × 10000/10000 = 250_000
	amount, err := CalculateCost(PricingParams{
		BillingMode: ModePerSecond, UnitPrice: 50_000, Quantity: 5, MultiplierBPS: 10_000,
	})
	if err != nil || amount != 250_000 {
		t.Fatalf("per_second = %d, err = %v", amount, err)
	}
}

// TestCalculateCostTokenCreate 仿真创建侧预估：cached=0，只算 input+output。
// 用例取自 service.TestTokenEstimateAmountAllowsVideoOutputOnly：
// output=119790, outPrice=16_000_000, multiplier=10_000 → 1_916_640
func TestCalculateCostTokenCreate(t *testing.T) {
	amount, err := CalculateCost(PricingParams{
		BillingMode: ModeToken,
		InputTokens: 0, OutputTokens: 119790, CachedTokens: 0,
		InputPrice: 0, OutputPrice: 16_000_000, CachedPrice: 0,
		MultiplierBPS: 10_000,
	})
	if err != nil {
		t.Fatalf("token create error = %v", err)
	}
	if amount != 1_916_640 {
		t.Fatalf("token create = %d, want 1_916_640", amount)
	}
}

// TestCalculateCostTokenSettle 仿真结算侧真实用量：cached>0。
// 用例取自 repository.TestTokenUsageAmountSettlesArkVideoCompletionTokens：
// output=108900, outPrice=16_000_000, multiplier=10_000 → 1_742_400
func TestCalculateCostTokenSettle(t *testing.T) {
	amount, err := CalculateCost(PricingParams{
		BillingMode: ModeToken,
		InputTokens: 0, OutputTokens: 108900, CachedTokens: 0,
		InputPrice: 0, OutputPrice: 16_000_000, CachedPrice: 0,
		MultiplierBPS: 10_000,
	})
	if err != nil {
		t.Fatalf("token settle error = %v", err)
	}
	if amount != 1_742_400 {
		t.Fatalf("token settle = %d, want 1_742_400", amount)
	}
}

// TestTokenAmountCachedDeduction 验证结算侧 cached 扣减由调用方处理：
// input = usage.Input - usage.Cached，cached 单独按 CachedPrice 计费。
func TestTokenAmountCachedDeduction(t *testing.T) {
	// input=100, output=200, cached=50；inPrice=3, outPrice=5, cachedPrice=2, multiplier=10000
	// base = 100×3 + 200×5 + 50×2 = 300 + 1000 + 100 = 1400
	// amount = 1400 × 10000 / 10_000_000_000 = 0（小于 1 microcredit）
	// 放大价格让结果可见：inPrice=3_000_000, outPrice=5_000_000, cachedPrice=2_000_000
	// base = 100×3M + 200×5M + 50×2M = 300M + 1000M + 100M = 1_400_000_000
	// amount = 1_400_000_000 × 10000 / 10_000_000_000 = 1400
	amount, err := TokenAmount(100, 200, 50, 3_000_000, 5_000_000, 2_000_000, 10_000)
	if err != nil {
		t.Fatalf("cached deduction error = %v", err)
	}
	if amount != 1400 {
		t.Fatalf("cached deduction = %d, want 1400", amount)
	}
}

// TestCreditAmountInvalidParams 验证参数非法返回 error。
func TestCreditAmountInvalidParams(t *testing.T) {
	if _, err := CreditAmount(-1, 1, 10_000); err == nil {
		t.Fatal("negative unitPrice should error")
	}
	if _, err := CreditAmount(100, 0, 10_000); err == nil {
		t.Fatal("zero quantity should error")
	}
	if _, err := CreditAmount(100, 1, 0); err == nil {
		t.Fatal("zero multiplier should error")
	}
}

// TestTokenAmountInvalidParams 验证负数返回 error。
func TestTokenAmountInvalidParams(t *testing.T) {
	if _, err := TokenAmount(-1, 0, 0, 0, 0, 0, 10_000); err == nil {
		t.Fatal("negative input should error")
	}
	if _, err := TokenAmount(0, -1, 0, 0, 0, 0, 10_000); err == nil {
		t.Fatal("negative output should error")
	}
	if _, err := TokenAmount(0, 0, -1, 0, 0, 0, 10_000); err == nil {
		t.Fatal("negative cached should error")
	}
}

// TestTokenAmountZeroMultiplier 验证零倍率返回 error（对齐 repository 侧）。
func TestTokenAmountZeroMultiplier(t *testing.T) {
	if _, err := TokenAmount(0, 100, 0, 0, 16_000_000, 0, 0); err == nil {
		t.Fatal("zero multiplier should error")
	}
}

// TestCalculateCostUnsupportedMode 验证未知 BillingMode 返回 error。
func TestCalculateCostUnsupportedMode(t *testing.T) {
	if _, err := CalculateCost(PricingParams{BillingMode: "unknown"}); err == nil {
		t.Fatal("unsupported mode should error")
	}
}

// TestCalculateVideoBucketHit 验证 per_video_bucket 命中档位返回配置价格（不乘 multiplier）。
// buckets 值用 float64 模拟 JSON 反序列化后的形态，确保 toInt64 正确解析。
func TestCalculateVideoBucketHit(t *testing.T) {
	config := map[string]any{
		"buckets": map[string]any{
			"5_720p":  float64(100_000),
			"10_1080p": float64(200_000),
		},
		"bucket": "5_720p",
	}
	amount, err := CalculateCost(PricingParams{BillingMode: ModePerVideoBucket, Config: config, MultiplierBPS: 15_000})
	if err != nil {
		t.Fatalf("bucket hit error = %v", err)
	}
	if amount != 100_000 {
		t.Fatalf("bucket hit = %d, want 100_000 (multiplier 不叠加)", amount)
	}
}

// TestCalculateVideoBucketMissingConfig 验证缺 Config 返回明确 error，不静默 fallback。
func TestCalculateVideoBucketMissingConfig(t *testing.T) {
	if _, err := CalculateCost(PricingParams{BillingMode: ModePerVideoBucket}); err == nil {
		t.Fatal("nil config should error")
	}
}

// TestCalculateVideoBucketEmptyBuckets 验证 buckets 为空返回 error。
func TestCalculateVideoBucketEmptyBuckets(t *testing.T) {
	if _, err := CalculateCost(PricingParams{BillingMode: ModePerVideoBucket, Config: map[string]any{"bucket": "5_720p"}}); err == nil {
		t.Fatal("empty buckets should error")
	}
}

// TestCalculateVideoBucketMissingBucketKey 验证未匹配到 bucket 返回 error。
func TestCalculateVideoBucketMissingBucketKey(t *testing.T) {
	config := map[string]any{
		"buckets": map[string]any{"5_720p": float64(100_000)},
	}
	if _, err := CalculateCost(PricingParams{BillingMode: ModePerVideoBucket, Config: config}); err == nil {
		t.Fatal("missing bucket key should error")
	}
}

// TestCalculateVideoBucketUnknownBucket 验证档位不存在返回 error。
func TestCalculateVideoBucketUnknownBucket(t *testing.T) {
	config := map[string]any{
		"buckets": map[string]any{"5_720p": float64(100_000)},
		"bucket":  "99_4k",
	}
	if _, err := CalculateCost(PricingParams{BillingMode: ModePerVideoBucket, Config: config}); err == nil {
		t.Fatal("unknown bucket should error")
	}
}

// TestCalculateVideoBucketInvalidPrice 验证档位价格非法（0、负数、非数字）返回 error。
func TestCalculateVideoBucketInvalidPrice(t *testing.T) {
	zero := float64(0)
	negative := float64(-5)
	invalid := "not-a-number"
	cases := []map[string]any{
		{"buckets": map[string]any{"5_720p": zero}, "bucket": "5_720p"},
		{"buckets": map[string]any{"5_720p": negative}, "bucket": "5_720p"},
		{"buckets": map[string]any{"5_720p": invalid}, "bucket": "5_720p"},
	}
	for index, config := range cases {
		if _, err := CalculateCost(PricingParams{BillingMode: ModePerVideoBucket, Config: config}); err == nil {
			t.Fatalf("case %d invalid price should error", index)
		}
	}
}

// TestToInt64FloatTruncation 验证 toInt64 拒绝非整数 float64，避免截断丢失精度。
func TestToInt64FloatTruncation(t *testing.T) {
	if _, ok := toInt64(float64(100_000.5)); ok {
		t.Fatal("fractional float64 should be rejected")
	}
	v, ok := toInt64(float64(100_000))
	if !ok || v != 100_000 {
		t.Fatalf("integral float64 = %d, ok = %v", v, ok)
	}
}
