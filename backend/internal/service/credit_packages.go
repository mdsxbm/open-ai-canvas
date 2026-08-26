package service

import (
	"infinite-canvas/backend/internal/model"
	"strings"
)

// CreditPackage 是前台 Pricing 页与钱包充值卡片展示的积分套餐。
// 当前为一期内置配置；后续可改为 DB 表 + 管理后台维护，不需要迁移脚本。
type CreditPackage struct {
	Key                 string `json:"key"`
	Title               string `json:"title"`
	PriceFen            int64  `json:"priceFen"`
	PriceLabel          string `json:"priceLabel"`
	CreditsMicrocredits int64  `json:"creditsMicrocredits"`
	BonusLabel          string `json:"bonusLabel,omitempty"`
	PerkLabel           string `json:"perkLabel,omitempty"`
	Sort                int    `json:"sort"`
}

// SimulatePurchaseRequest 是一期模拟支付入参；PackageKey + Method + OrderID 参与幂等判定，
// 具体由 repo.GrantCreditsOnce 的 reference_key 唯一约束实现。
type SimulatePurchaseRequest struct {
	PackageKey string `json:"packageKey"`
	Method     string `json:"method"`
	OrderID    string `json:"orderId"`
}

// builtinCreditPackages 返回当前版本内置的套餐清单。key 是持久化稳定标识，
// 不要和前端 enum 重命名，否则旧 SimulatePurchase 幂等记录会失去关联。
func builtinCreditPackages() []CreditPackage {
	return []CreditPackage{
		{Key: "starter", Title: "体验包", PriceFen: 990, PriceLabel: "¥9.9", CreditsMicrocredits: 11_000_000, BonusLabel: "送 1,000 积分", PerkLabel: "适合首次体验", Sort: 1},
		{Key: "creator", Title: "创作者包", PriceFen: 9900, PriceLabel: "¥99", CreditsMicrocredits: 120_000_000, BonusLabel: "送 20,000 积分", PerkLabel: "月度创作够用", Sort: 2},
		{Key: "studio", Title: "工作室包", PriceFen: 29900, PriceLabel: "¥299", CreditsMicrocredits: 400_000_000, BonusLabel: "送 100,000 积分", PerkLabel: "高频批量创作", Sort: 3},
	}
}

func (s *Service) ListCreditPackages(_ *model.User) ([]CreditPackage, error) {
	packages := builtinCreditPackages()
	// 按 Sort 升序稳定返回（当前 slice 已有序，这里显式保证可读性）。
	for i := 1; i < len(packages); i++ {
		for j := i; j > 0 && packages[j].Sort < packages[j-1].Sort; j-- {
			packages[j], packages[j-1] = packages[j-1], packages[j]
		}
	}
	return packages, nil
}

func (s *Service) SimulatePurchase(user *model.User, req SimulatePurchaseRequest) (*model.CreditAccount, bool, error) {
	pkgKey := strings.TrimSpace(req.PackageKey)
	method := strings.TrimSpace(req.Method)
	orderID := strings.TrimSpace(req.OrderID)
	if user == nil || user.ID == "" {
		return nil, false, Unauthorized("请先登录")
	}
	if pkgKey == "" {
		return nil, false, BadAuthRequest("套餐不能为空")
	}
	if method != "wxpay" && method != "alipay" {
		return nil, false, BadAuthRequest("支付方式仅支持微信或支付宝")
	}
	if orderID == "" {
		return nil, false, BadAuthRequest("订单号不能为空")
	}
	var pkg *CreditPackage
	builtins := builtinCreditPackages()
	for index := range builtins {
		p := builtins[index]
		if p.Key == pkgKey {
			pp := p
			pkg = &pp
			break
		}
	}
	if pkg == nil {
		return nil, false, BadAuthRequest("积分套餐不存在或已下架")
	}
	// 使用 reference_key 做全局幂等：GrantCreditsOnce 对同一 reference_key 只入账一次，
	// 重复请求返回 granted=false 并回传当前账户快照，和前端一期 API 合同（account, granted, err）对齐。
	referenceKey := "simulate-purchase:" + user.ID + ":" + orderID
	note := "SimulatePurchase:" + pkgKey + "/" + method
	account, granted, err := s.repo.GrantCreditsOnce(user.ID, "admin_adjustment", pkg.CreditsMicrocredits, referenceKey, note)
	if err != nil {
		return nil, false, err
	}
	return account, granted, nil
}
