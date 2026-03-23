# خطة إضافة DocTypes وميزات POSNext إلى KLiK PoS

**المشروع:** KLiK PoS — POSNext Feature Parity Plan
**المرجع:** [POSNext (BrainWise-DEV)](https://github.com/BrainWise-DEV/POSNext) vs [KLiK PoS (Beveren)](https://github.com/Beveren-Software-Inc/KLiK_PoS)
**التاريخ:** مارس 2026
**المبدأ:** كل التطوير يتم داخل تطبيقات `klik_pos` و `klik_spa` — لا تطبيقات خارجية.

---

## جدول المحتويات

1. [تحليل الفجوة: POSNext vs KLiK](#1-تحليل-الفجوة-posnext-vs-klik)
2. [M1 — نظام العروض والكوبونات](#2-m1--نظام-العروض-والكوبونات-offers--coupons-engine)
3. [M2 — بطاقات الهدايا (Gift Cards)](#3-m2--بطاقات-الهدايا-gift-cards)
4. [M3 — إدارة الوردية المحسّنة (Enhanced Shift)](#4-m3--إدارة-الوردية-المحسّنة-enhanced-shift-management)
5. [M4 — الطلبات المؤجلة (Hold Orders / Draft Invoices)](#5-m4--الطلبات-المؤجلة-hold-orders--draft-invoices)
6. [M5 — Offline-First Architecture](#6-m5--offline-first-architecture)
7. [M6 — برنامج الولاء (Loyalty Program)](#7-m6--برنامج-الولاء-loyalty-program)
8. [M7 — شاشة العميل (Customer Display)](#8-m7--شاشة-العميل-customer-display)
9. [M8 — تحسينات الأداء والتجربة](#9-m8--تحسينات-الأداء-والتجربة-ux--performance)
10. [ملخص DocTypes الجديدة](#10-ملخص-doctypes-الجديدة-الكاملة)
11. [ملخص تنفيذي وجدول زمني](#11-ملخص-تنفيذي-وجدول-زمني)

---

## 1. تحليل الفجوة: POSNext vs KLiK

### 1.1 ما يمتلكه POSNext وغير موجود في KLiK

| الميزة | POSNext | KLiK | الأولوية |
|--------|---------|------|----------|
| **DocType: POS Offer** | ✅ موجود | ❌ غائب | 🔴 عالية |
| **DocType: POS Coupon** | ✅ موجود | ❌ غائب | 🔴 عالية |
| **DocType: Gift Card** | ✅ موجود | ❌ غائب | 🔴 عالية |
| **DocType: POS Shift (Enhanced)** | ✅ مخصص | ⚠️ ERPNext فقط | 🔴 عالية |
| **Hold Orders / Draft Invoices** | ✅ موجود | ❌ غائب | 🔴 عالية |
| **Offline-First (IndexedDB + SW)** | ✅ كامل | ⚠️ جزئي | 🟠 متوسطة |
| **Loyalty Program** | ✅ موجود | ❌ غائب | 🟠 متوسطة |
| **Customer-Facing Display** | ✅ موجود | ❌ غائب | 🟡 منخفضة |
| **Virtual Scrolling** | ✅ موجود | ❌ غائب | 🟠 متوسطة |
| **Keyboard Shortcuts** | ✅ (F4,F8,F9) | ⚠️ محدودة | 🟡 منخفضة |
| **Stack Multiple Promotions** | ✅ موجود | ❌ غائب | 🔴 عالية |
| **Auto-apply Eligible Offers** | ✅ موجود | ❌ غائب | 🔴 عالية |
| **PWA / Service Worker** | ✅ موجود | ❌ غائب | 🟠 متوسطة |
| **Multi-Currency Symbols** | ✅ كامل | ⚠️ جزئي | 🟡 منخفضة |
| **Web Workers for Performance** | ✅ موجود | ❌ غائب | 🟠 متوسطة |

### 1.2 ما يمتلكه KLiK ولا يمتلكه POSNext

| الميزة | KLiK |
|--------|------|
| ZATCA Phase 2 Compliance | ✅ |
| B2B / B2C / Hybrid mode | ✅ |
| WhatsApp / SMS Invoice Sharing | ✅ |
| React 19 + TypeScript (حديث أكثر من Vue 3) | ✅ |
| Barcode Scanner dedicated mode | ✅ |
| Multi-Invoice Credit Notes | ✅ |

> **الخلاصة:** KLiK يتفوق في الامتثال الضريبي والمشاركة. POSNext يتفوق في المحرك الترويجي، الـ Offline، وإدارة الشفت.

---

## 2. M1 — نظام العروض والكوبونات (Offers & Coupons Engine)

### 2.1 DocType: `KLiK POS Offer`

هذا هو أبرز ما يميز POSNext. محرك عروض كامل متكامل مع ERPNext Pricing Rules.

#### Schema الكاملة

| Field | Type | الوصف |
|-------|------|-------|
| `title` | Data | اسم العرض (للعرض الداخلي) |
| `is_active` | Check | تفعيل/تعطيل العرض |
| `offer_type` | Select | `Percentage Discount / Fixed Discount / Buy X Get Y / Bundle / Tiered` |
| `pos_profiles` | Table → KLiK POS Offer Profile | نقاط البيع التي يُطبق عليها |
| `valid_from` | Date | تاريخ البداية |
| `valid_to` | Date | تاريخ الانتهاء |
| `days_of_week` | MultiSelect | أيام التفعيل (السبت، الأحد...) |
| `start_time` | Time | وقت البداية اليومي (اختياري) |
| `end_time` | Time | وقت الانتهاء اليومي (اختياري) |
| `apply_on` | Select | `Item Code / Item Group / All Items` |
| `items` | Table → KLiK POS Offer Item | المنتجات المؤهلة |
| `item_groups` | Table → KLiK POS Offer Item Group | مجموعات المنتجات |
| `min_qty` | Float | الحد الأدنى للكمية |
| `min_amount` | Currency | الحد الأدنى للمبلغ |
| `max_uses` | Int | الحد الأقصى لعدد الاستخدامات |
| `uses_per_customer` | Int | الحد الأقصى لكل عميل |
| `current_uses` | Int (RO) | العدد الحالي للاستخدامات |
| `discount_percentage` | Percent | نسبة الخصم (لـ Percentage type) |
| `discount_amount` | Currency | مبلغ الخصم (لـ Fixed type) |
| `apply_discount_on` | Select | `Grand Total / Each Item` |
| `free_item` | Link → Item | المنتج المجاني (لـ Buy X Get Y) |
| `free_qty` | Float | كمية المنتج المجاني |
| `free_item_rate` | Currency | سعر المنتج المجاني (0 = مجاني) |
| `tiers` | Table → KLiK POS Offer Tier | شرائح الخصم (لـ Tiered) |
| `stackable` | Check | هل يمكن تطبيقه مع عروض أخرى؟ |
| `priority` | Int | الأولوية (الأعلى = يُطبق أولاً) |
| `description` | Text Editor | وصف العرض للعرض على الواجهة |
| `pricing_rule` | Link → Pricing Rule | ربط بـ ERPNext Pricing Rule |

#### Child Tables المطلوبة

```
KLiK POS Offer Item        → item_code, item_name
KLiK POS Offer Item Group  → item_group
KLiK POS Offer Profile     → pos_profile
KLiK POS Offer Tier        → min_qty, min_amount, discount_percentage, discount_amount
KLiK POS Offer Usage       → pos_invoice, customer, date, offer, discount_applied
```

#### منطق المحرك (Offer Engine)

```python
# klik_pos/api/offers.py

@frappe.whitelist()
def get_applicable_offers(pos_profile, items, customer=None, grand_total=0):
    """
    يُعيد العروض المؤهلة للسلة الحالية مرتبة حسب الأولوية.
    يُفحص:
      - التواريخ والأوقات
      - نقطة البيع
      - الحد الأدنى (qty / amount)
      - حدود الاستخدام (total + per customer)
      - أي منتجات مؤهلة
    """

@frappe.whitelist()
def apply_offers(pos_profile, items, selected_offers, customer=None):
    """
    يُطبق العروض المحددة على السلة.
    يحترم الـ stackable flag والـ priority.
    يُعيد السلة المعدّلة + الخصومات المفصّلة.
    """

@frappe.whitelist()
def record_offer_usage(pos_invoice, applied_offers):
    """يُسجّل استخدام العرض في KLiK POS Offer Usage بعد تأكيد الفاتورة"""
```

### 2.2 DocType: `KLiK POS Coupon`

| Field | Type | الوصف |
|-------|------|-------|
| `coupon_code` | Data (Unique) | كود الكوبون (مثال: SUMMER25) |
| `coupon_name` | Data | اسم وصفي |
| `coupon_type` | Select | `Percentage / Fixed Amount / Free Item / Free Shipping` |
| `is_active` | Check | تفعيل/تعطيل |
| `valid_from` | Date | تاريخ البداية |
| `valid_to` | Date | تاريخ الانتهاء |
| `discount_percentage` | Percent | نسبة الخصم |
| `discount_amount` | Currency | مبلغ الخصم الثابت |
| `free_item` | Link → Item | المنتج المجاني |
| `free_qty` | Float | الكمية المجانية |
| `min_order_amount` | Currency | الحد الأدنى للطلب |
| `max_discount_amount` | Currency | الحد الأقصى للخصم (لـ Percentage) |
| `max_uses` | Int | الحد الأقصى للاستخدامات الكلية |
| `uses_per_customer` | Int | استخدامات لكل عميل |
| `current_uses` | Int (RO) | العداد الحالي |
| `applicable_customers` | Table | عملاء محددون (فارغ = الكل) |
| `applicable_items` | Table | منتجات محددة (فارغ = الكل) |
| `pos_profiles` | Table | نقاط البيع (فارغ = الكل) |
| `is_one_time` | Check | للاستخدام مرة واحدة فقط |
| `generated_by` | Link → User | من أنشأ الكوبون |

#### API

```python
@frappe.whitelist()
def validate_coupon(coupon_code, customer, pos_profile, grand_total, items):
    """
    يتحقق من صلاحية الكوبون ويُعيد تفاصيل الخصم.
    يُعيد: {valid, discount_type, discount_value, message}
    """

@frappe.whitelist()
def apply_coupon(coupon_code, pos_invoice):
    """يُسجّل استخدام الكوبون بعد تأكيد الفاتورة"""
```

### 2.3 الفرونت اند — Offers & Coupons UI

#### مكون `OffersDialog.tsx` (جديد)

زر **"العروض المتاحة 🎁"** يظهر في شاشة الكاشير عندما تكون هناك عروض مؤهلة:

```
┌────────────────────────────────────────────────────────┐
│  🎁 العروض المتاحة (3)                                  │
├────────────────────────────────────────────────────────┤
│  ✅ اشتري 2 واحصل على 1 مجاناً                         │
│     أكريليك 50×70 — خصم تلقائي                        │
│                              [ تطبيق ]                 │
├────────────────────────────────────────────────────────┤
│  🏷️ خصم 15% على طلبات فوق 500 ريال                    │
│     ينتهي اليوم الساعة 10 مساءً                        │
│                              [ تطبيق ]                 │
├────────────────────────────────────────────────────────┤
│  🔖 أدخل كود كوبون:  [____________]  [ تحقق ]         │
└────────────────────────────────────────────────────────┘
```

#### `useOffersStore.ts`

```typescript
interface OffersStore {
  availableOffers:    POSOffer[];
  appliedOffers:      AppliedOffer[];
  appliedCoupon:      POSCoupon | null;
  totalDiscount:      number;
  loadOffers:         (cart: CartItem[], customer?: string) => Promise<void>;
  applyOffer:         (offerId: string) => void;
  removeOffer:        (offerId: string) => void;
  validateCoupon:     (code: string) => Promise<ValidationResult>;
  applyCoupon:        (code: string) => void;
  removeCoupon:       () => void;
  getOffersCount:     () => number;  // للـ Badge
}
```

#### تكامل مع السلة

- الخصومات تظهر **سطراً منفصلاً** في ملخص الفاتورة
- كل عرض/كوبون مطبّق يظهر مع زر إزالة
- عند تغيير السلة تُعاد جلب العروض تلقائياً (debounced 300ms)

### 2.4 التكامل مع ERPNext Pricing Rules

```
KLiK POS Offer → auto-creates/links → ERPNext Pricing Rule
                                      (for accounting purposes)
```

الـ Offer Engine يعمل **بجانب** ERPNext Pricing Rules، وعند تأكيد الفاتورة يُرسل الخصومات كـ `discount_amount` على مستوى الفاتورة أو على مستوى السطر.

---

## 3. M2 — بطاقات الهدايا (Gift Cards)

### 3.1 DocType: `KLiK Gift Card`

| Field | Type | الوصف |
|-------|------|-------|
| `card_number` | Data (Unique) | رقم البطاقة (يُولَّد تلقائياً) |
| `card_name` | Data | اسم وصفي / مناسبة |
| `status` | Select | `Active / Redeemed / Expired / Cancelled` |
| `initial_value` | Currency | القيمة الأولية |
| `current_balance` | Currency | الرصيد الحالي |
| `currency` | Link → Currency | العملة |
| `issued_by` | Link → User | من أصدر البطاقة |
| `issued_date` | Date | تاريخ الإصدار |
| `expiry_date` | Date | تاريخ الانتهاء |
| `customer` | Link → Customer | العميل (اختياري — بطاقات مجهولة مدعومة) |
| `is_physical_card` | Check | بطاقة فيزيائية أم رقمية |
| `pos_profile` | Link → POS Profile | نقطة البيع المصدرة |
| `transactions` | Table → KLiK Gift Card Transaction | سجل العمليات |

### 3.2 DocType: `KLiK Gift Card Transaction` (Child)

| Field | Type | الوصف |
|-------|------|-------|
| `transaction_date` | Datetime | وقت العملية |
| `transaction_type` | Select | `Issue / Redeem / Reload / Refund` |
| `amount` | Currency | المبلغ |
| `balance_after` | Currency | الرصيد بعد العملية |
| `pos_invoice` | Link → POS Invoice | الفاتورة المرتبطة |
| `cashier` | Link → User | الكاشير |

### 3.3 API

```python
# klik_pos/api/gift_cards.py

@frappe.whitelist()
def issue_gift_card(initial_value, customer=None, expiry_date=None, pos_profile=None):
    """إصدار بطاقة هدية جديدة"""

@frappe.whitelist()
def get_gift_card_balance(card_number):
    """الاستعلام عن رصيد البطاقة"""

@frappe.whitelist()
def redeem_gift_card(card_number, amount, pos_invoice):
    """استرداد جزء أو كل رصيد البطاقة"""

@frappe.whitelist()
def reload_gift_card(card_number, amount, pos_invoice):
    """إعادة شحن البطاقة"""

@frappe.whitelist()
def validate_gift_card(card_number):
    """التحقق من صلاحية البطاقة قبل الاستخدام"""
```

### 3.4 واجهة المستخدم

```
في Payment Dialog:
  وسيلة الدفع: [Gift Card]
  رقم البطاقة: [________________] [تحقق]
                    الرصيد: 250.00 ريال
  المبلغ المُستخدم: [250.00]
  المتبقي من الفاتورة: 50.00 ريال → وسيلة دفع أخرى
```

- إمكانية إصدار بطاقة جديدة من داخل الـ POS
- إمكانية إعادة الشحن من داخل الـ POS

---

## 4. M3 — إدارة الوردية المحسّنة (Enhanced Shift Management)

KLiK يستخدم ERPNext's `POS Opening Entry` و `POS Closing Entry`. POSNext يضيف طبقة إضافية لتتبع أدق.

### 4.1 DocType: `KLiK POS Shift`

| Field | Type | الوصف |
|-------|------|-------|
| `shift_name` | Data (RO) | SHIFT-YYYY-XXXXX |
| `pos_profile` | Link → POS Profile | نقطة البيع |
| `cashier` | Link → User | الكاشير |
| `opening_entry` | Link → POS Opening Entry | الربط بـ ERPNext |
| `closing_entry` | Link → POS Closing Entry | الربط بـ ERPNext |
| `status` | Select | `Open / Closed / Discrepancy` |
| `opening_time` | Datetime | وقت فتح الوردية |
| `closing_time` | Datetime | وقت إغلاق الوردية |
| `opening_cash` | Currency | النقد الافتتاحي المُعلن |
| `closing_cash_declared` | Currency | النقد الختامي المُعلن من الكاشير |
| `closing_cash_expected` | Currency | النقد المتوقع من النظام |
| `cash_discrepancy` | Currency (RO) | الفرق (موجب/سالب) |
| `discrepancy_reason` | Text | سبب الفرق إن وُجد |
| `total_invoices` | Int (RO) | عدد الفواتير |
| `total_sales` | Currency (RO) | إجمالي المبيعات |
| `total_returns` | Currency (RO) | إجمالي المرتجعات |
| `net_sales` | Currency (RO) | صافي المبيعات |
| `total_discounts` | Currency (RO) | إجمالي الخصومات |
| `payment_summary` | Table → KLiK Shift Payment | ملخص كل وسيلة دفع |
| `cash_movements` | Table → KLiK Shift Cash Movement | حركات النقد (Cash In/Out) |
| `notes` | Text | ملاحظات الكاشير |

### 4.2 DocType: `KLiK Shift Cash Movement`

| Field | Type | الوصف |
|-------|------|-------|
| `movement_type` | Select | `Cash In / Cash Out` |
| `amount` | Currency | المبلغ |
| `reason` | Data | السبب (صرفية، دفعة...) |
| `authorized_by` | Link → User | المسؤول |
| `timestamp` | Datetime | وقت الحركة |
| `reference` | Data | رقم مرجعي (اختياري) |

### 4.3 DocType: `KLiK Shift Payment Summary`

| Field | Type | الوصف |
|-------|------|-------|
| `mode_of_payment` | Link → Mode of Payment | وسيلة الدفع |
| `expected_amount` | Currency | المتوقع من النظام |
| `declared_amount` | Currency | المُعلن من الكاشير |
| `difference` | Currency (RO) | الفرق |

### 4.4 واجهة المستخدم

#### Shift Timer في الهيدر

```
┌──────────────────────────────────────────────────────┐
│  KLiK POS  │  ⏱ 02:34:17  │  💰 1,450 ريال  │ ...  │
└──────────────────────────────────────────────────────┘
```

#### Cash Movement Dialog

زر **"حركة نقد"** في قائمة الكاشير:
- Cash In: إضافة نقد للصندوق
- Cash Out: سحب نقد من الصندوق
- كلاهما يُسجَّل فوراً في `KLiK Shift Cash Movement`

#### Closing Shift Screen المحسّنة

```
┌────────────────────────────────────────────────────────┐
│  إغلاق الوردية                                          │
├────────────────────────────────────────────────────────┤
│  الكاشير: أحمد    │  مدة الوردية: 8 ساعات 15 دقيقة    │
├────────────────────────────────────────────────────────┤
│  ملخص المبيعات:                                         │
│  الفواتير: 47    │  الإجمالي: 12,450 ريال              │
│  المرتجعات: 2    │  الصافي: 12,100 ريال               │
│  الخصومات: 350 ريال                                    │
├────────────────────────────────────────────────────────┤
│  وسيلة الدفع        متوقع       مُعلَن       فرق       │
│  نقد               5,000       [____]       ---        │
│  Visa              4,100       [4100]       0.00       │
│  Mada              3,000       [____]       ---        │
├────────────────────────────────────────────────────────┤
│  💡 اضبط الحقول الفارغة ثم اضغط إغلاق                 │
│                         [ إغلاق الوردية ]              │
└────────────────────────────────────────────────────────┘
```

> **Hide Expected Amount** (موجود في KLiK Profile): إذا مفعّل → يُخفي عمود "متوقع" ويطلب من الكاشير إدخال المبالغ بشكل أعمى.

### 4.5 API

```python
# klik_pos/api/shift.py

@frappe.whitelist()
def open_shift(pos_profile, opening_cash):
    """يفتح وردية جديدة ويُنشئ KLiK POS Shift + POS Opening Entry"""

@frappe.whitelist()
def get_current_shift(pos_profile):
    """يجلب بيانات الوردية الحالية مع الملخص الحي"""

@frappe.whitelist()
def add_cash_movement(shift_name, movement_type, amount, reason, authorized_by):
    """يُسجّل حركة نقد"""

@frappe.whitelist()
def close_shift(shift_name, payment_declarations, notes=""):
    """يُغلق الوردية ويحسب الفوارق ويُنشئ POS Closing Entry"""

@frappe.whitelist()
def get_shift_report(shift_name):
    """تقرير تفصيلي للوردية"""
```

---

## 5. M4 — الطلبات المؤجلة (Hold Orders / Draft Invoices)

### 5.1 DocType: `KLiK POS Draft Order`

| Field | Type | الوصف |
|-------|------|-------|
| `draft_name` | Data | اسم مرجعي (مثال: "طاولة 5" أو "أحمد") |
| `pos_profile` | Link → POS Profile | نقطة البيع |
| `cashier` | Link → User | من حفظ الطلب |
| `customer` | Link → Customer | العميل (اختياري) |
| `items` | JSON / Table | بيانات السلة كاملة (items + dimensions + offers) |
| `applied_offers` | JSON | العروض المطبقة |
| `applied_coupon` | Data | كود الكوبون إن وُجد |
| `gift_card` | Data | رقم بطاقة الهدية إن وُجدت |
| `total_amount` | Currency | إجمالي الطلب |
| `saved_at` | Datetime | وقت الحفظ |
| `expires_at` | Datetime | وقت انتهاء الصلاحية (72 ساعة افتراضياً) |
| `status` | Select | `Held / Resumed / Cancelled / Expired` |
| `device_id` | Data | معرّف الجهاز (للاسترداد من أي جهاز) |

### 5.2 API

```python
@frappe.whitelist()
def save_draft_order(cart_state, draft_name="", customer=None):
    """يحفظ حالة السلة الكاملة كطلب مؤجل"""

@frappe.whitelist()
def get_draft_orders(pos_profile, status="Held"):
    """يجلب قائمة الطلبات المؤجلة"""

@frappe.whitelist()
def resume_draft_order(draft_id):
    """يستعيد بيانات الطلب ليُحمَّل في السلة"""

@frappe.whitelist()
def cancel_draft_order(draft_id):
    """يُلغي الطلب المؤجل"""

@frappe.whitelist()
def cleanup_expired_drafts():
    """cron job: يُلغي تلقائياً الطلبات المنتهية الصلاحية"""
```

### 5.3 واجهة المستخدم

#### زر Hold في الـ POS

```
[ 📋 الطلبات المؤجلة  🔴 3 ]   ← في هيدر الـ POS
```

#### Hold Orders Panel

```
┌─────────────────────────────────────────────────────────┐
│  الطلبات المؤجلة                            [+ طلب جديد] │
├─────────────────────────────────────────────────────────┤
│  📋 "طاولة 5"     │  3 منتجات  │  450 ريال  │  منذ 5 د  │
│                                    [ استرداد ] [ حذف ]  │
├─────────────────────────────────────────────────────────┤
│  📋 "أحمد"        │  1 منتج    │  120 ريال  │  منذ 12 د │
│                                    [ استرداد ] [ حذف ]  │
└─────────────────────────────────────────────────────────┘
```

**Keyboard Shortcut:** `Ctrl+S` → فتح نافذة تسمية الطلب ثم حفظه

### 5.4 Sync عبر الأجهزة

الطلبات المؤجلة محفوظة في الباك اند → متاحة من أي جهاز في نفس الـ POS Profile.

---

## 6. M5 — Offline-First Architecture

### 6.1 الوضع الحالي في KLiK

KLiK يمتلك Offline support جزئي. POSNext يمتلك **Offline-First كامل** عبر:
- IndexedDB (محلي)
- Service Worker (PWA)
- Background Sync
- Web Workers

### 6.2 ما يجب إضافته

#### 6.2.1 `KLiK POS Offline Queue` (DocType)

| Field | Type | الوصف |
|-------|------|-------|
| `device_id` | Data | معرّف الجهاز |
| `queue_type` | Select | `Invoice / Draft / Offer Usage / Gift Card` |
| `payload` | JSON | البيانات المنتظرة للمزامنة |
| `status` | Select | `Pending / Synced / Failed` |
| `created_at` | Datetime | وقت الإنشاء |
| `synced_at` | Datetime | وقت المزامنة |
| `retry_count` | Int | عدد المحاولات |
| `error_message` | Text | رسالة الخطأ إن وُجدت |
| `pos_profile` | Link → POS Profile | نقطة البيع |

#### 6.2.2 مكونات الفرونت اند

```
klik_spa/src/
├── workers/
│   ├── syncWorker.ts        ← Web Worker للمزامنة في الخلفية
│   └── stockWorker.ts       ← Web Worker لتحديث المخزون
├── sw/
│   └── serviceWorker.ts     ← Service Worker للـ PWA + Cache
├── offline/
│   ├── OfflineDB.ts         ← Dexie.js wrapper (موجود جزئياً)
│   ├── SyncQueue.ts         ← قائمة الانتظار للمزامنة
│   └── OfflineIndicator.tsx ← مؤشر الاتصال في الـ UI
```

#### 6.2.3 استراتيجية التخزين المحلي (IndexedDB via Dexie.js)

```typescript
// OfflineDB schema
interface KLiKOfflineDB {
  items:          CachedItem[];       // بيانات المنتجات
  customers:      CachedCustomer[];   // بيانات العملاء
  offers:         CachedOffer[];      // العروض الفعّالة
  drafts:         DraftOrder[];       // الطلبات المؤجلة
  pendingInvoices: PendingInvoice[];  // فواتير تنتظر المزامنة
  settings:       POSSettings;        // إعدادات نقطة البيع
}
```

#### 6.2.4 مؤشر الحالة في الـ UI

```
متصل:     🟢 متصل
منقطع:    🔴 غير متصل — تعمل بوضع Offline (3 فواتير في الانتظار)
يزامن:    🔵 جارٍ مزامنة 3 فواتير...
```

#### 6.2.5 PWA Manifest

```json
// klik_spa/public/manifest.json
{
  "name":             "KLiK PoS",
  "short_name":       "KLiK",
  "start_url":        "/klik_pos",
  "display":          "standalone",
  "background_color": "#FFFFFF",
  "theme_color":      "#1B4F72",
  "icons": [...]
}
```

---

## 7. M6 — برنامج الولاء (Loyalty Program)

### 7.1 DocType: `KLiK Loyalty Program`

| Field | Type | الوصف |
|-------|------|-------|
| `program_name` | Data | اسم البرنامج |
| `is_active` | Check | تفعيل/تعطيل |
| `collection_rules` | Table → KLiK Loyalty Tier | شرائح التجميع |
| `points_per_amount` | Float | نقاط لكل وحدة عملة |
| `minimum_points_to_redeem` | Int | الحد الأدنى للاسترداد |
| `redemption_rate` | Float | قيمة النقطة عند الاسترداد (ريال) |
| `expiry_months` | Int | انتهاء النقاط بعد (شهر) |
| `applicable_pos_profiles` | Table | نقاط البيع |
| `excluded_items` | Table | منتجات مستثناة |
| `excluded_item_groups` | Table | مجموعات مستثناة |

### 7.2 DocType: `KLiK Customer Loyalty Points`

| Field | Type | الوصف |
|-------|------|-------|
| `customer` | Link → Customer | العميل |
| `loyalty_program` | Link → KLiK Loyalty Program | البرنامج |
| `total_points` | Float | الرصيد الكلي |
| `redeemed_points` | Float | النقاط المستردة |
| `available_points` | Float (RO) | النقاط المتاحة |
| `tier` | Data | المستوى الحالي (Bronze/Silver/Gold) |
| `transactions` | Table → KLiK Loyalty Transaction | سجل العمليات |

### 7.3 DocType: `KLiK Loyalty Transaction`

| Field | Type | الوصف |
|-------|------|-------|
| `transaction_type` | Select | `Earn / Redeem / Expire / Adjust` |
| `points` | Float | عدد النقاط |
| `balance_after` | Float | الرصيد بعد العملية |
| `pos_invoice` | Link → POS Invoice | الفاتورة المرتبطة |
| `expiry_date` | Date | تاريخ انتهاء هذه النقاط |
| `transaction_date` | Datetime | وقت العملية |

### 7.4 API

```python
# klik_pos/api/loyalty.py

@frappe.whitelist()
def get_customer_points(customer, loyalty_program=None):
    """رصيد النقاط الحالي"""

@frappe.whitelist()
def calculate_earn_points(items, grand_total, loyalty_program):
    """النقاط التي سيكسبها العميل من هذه الفاتورة"""

@frappe.whitelist()
def redeem_points(customer, points_to_redeem, pos_invoice):
    """استرداد نقاط كخصم على الفاتورة"""

@frappe.whitelist()
def post_sale_earn(pos_invoice, customer, loyalty_program):
    """يُستدعى من on_submit — يُضيف النقاط المكتسبة"""
```

### 7.5 UI في الـ POS

```
في Customer Card:
  👤 محمد أحمد
  ⭐ 1,250 نقطة  │  المستوى: Gold
  [ استخدام النقاط ]

في Payment Dialog:
  💳 استخدام نقاط الولاء
  1,250 نقطة = 12.50 ريال خصم
  [ استخدام 12.50 ريال ]
```

---

## 8. M7 — شاشة العميل (Customer Display)

### 8.1 DocType: `KLiK Customer Display Config`

| Field | Type | الوصف |
|-------|------|-------|
| `pos_profile` | Link → POS Profile | نقطة البيع |
| `display_mode` | Select | `Simple / Branded / Promotional` |
| `logo` | Attach Image | شعار المتجر |
| `background_image` | Attach Image | خلفية الشاشة |
| `idle_message` | Data | رسالة عند عدم النشاط |
| `show_item_images` | Check | عرض صور المنتجات |
| `show_running_total` | Check | عرض الإجمالي المتحرك |
| `promotional_slides` | Table | شرائح إعلانية في وضع Idle |
| `currency` | Link → Currency | العملة |

### 8.2 واجهة الشاشة

شاشة URL منفصلة: `/klik_pos/customer_display/{pos_profile}` تُفتح على شاشة ثانية:

```
وضع نشط:              وضع Idle:
┌──────────────────┐  ┌──────────────────┐
│ [شعار المتجر]    │  │   [صورة ترويجية] │
│                  │  │                  │
│ لوح أكريليك ×2  │  │  "أهلاً بكم في   │
│          42.00   │  │   KLiK PoS"      │
│ إطار معدني ×1   │  │                  │
│          35.00   │  │  [شريحة تالية]   │
│ ─────────────── │  │                  │
│ الإجمالي:        │  └──────────────────┘
│       77.00 ريال │
└──────────────────┘
```

### 8.3 Real-time Sync

البيانات تُرسل للشاشة عبر نفس WebSocket المستخدم في الـ POS:

```typescript
// في useCartStore: عند كل تغيير في السلة
frappe.realtime.publish('customer_display_update', cartSummary, pos_profile)
```

---

## 9. M8 — تحسينات الأداء والتجربة (UX & Performance)

### 9.1 Virtual Scrolling

للتعامل مع قوائم المنتجات الكبيرة (+1000 منتج):

```typescript
// استبدال ItemGrid الحالي بنسخة تدعم Virtual Scrolling
// باستخدام @tanstack/react-virtual

import { useVirtualizer } from '@tanstack/react-virtual'
```

### 9.2 اختصارات لوحة المفاتيح الكاملة

| الاختصار | الوظيفة |
|----------|---------|
| `F4` | تركيز على حقل البحث عن منتج |
| `F8` | تركيز على حقل البحث عن عميل |
| `F9` | الانتقال لشاشة الدفع |
| `Ctrl+S` | حفظ كطلب مؤجل |
| `Ctrl+Z` | التراجع عن آخر إضافة للسلة |
| `Ctrl+R` | فتح قائمة المرتجعات |
| `Ctrl+O` | فتح العروض المتاحة |
| `Escape` | إغلاق النافذة الحالية |
| `+` / `-` | زيادة/تقليل كمية العنصر المحدد |
| `Delete` | حذف العنصر المحدد من السلة |

### 9.3 Web Workers

```typescript
// Heavy computations off the main thread
workers/
├── offerCalculator.worker.ts   ← حساب العروض المعقدة
├── stockSync.worker.ts         ← مزامنة المخزون في الخلفية
└── reportGenerator.worker.ts  ← إنشاء تقارير الوردية
```

### 9.4 تحسينات الـ KLiK Settings

إضافة **`KLiK PoS Settings`** DocType مخصص (Single DocType):

| الإعداد | Type | الوصف |
|---------|------|-------|
| `enable_offers` | Check | تفعيل نظام العروض |
| `enable_coupons` | Check | تفعيل الكوبونات |
| `enable_gift_cards` | Check | تفعيل بطاقات الهدايا |
| `enable_loyalty` | Check | تفعيل برنامج الولاء |
| `enable_customer_display` | Check | تفعيل شاشة العميل |
| `enable_virtual_scroll` | Check | تفعيل Virtual Scrolling |
| `draft_expiry_hours` | Int | مدة صلاحية الطلبات المؤجلة |
| `offline_sync_interval` | Int | فترة المزامنة في الخلفية (ثوان) |
| `auto_apply_offers` | Check | تطبيق العروض تلقائياً |
| `show_offer_button` | Check | إظهار زر العروض |
| `keyboard_shortcuts` | Check | تفعيل اختصارات لوحة المفاتيح |
| `customer_display_url` | Data (RO) | رابط شاشة العميل |

---

## 10. ملخص DocTypes الجديدة الكاملة

### DocTypes الأساسية (جديدة بالكامل)

| DocType | النوع | الـ Module |
|---------|-------|------------|
| `KLiK POS Offer` | Regular | klik_pos |
| `KLiK POS Offer Item` | Child | klik_pos |
| `KLiK POS Offer Item Group` | Child | klik_pos |
| `KLiK POS Offer Profile` | Child | klik_pos |
| `KLiK POS Offer Tier` | Child | klik_pos |
| `KLiK POS Offer Usage` | Regular | klik_pos |
| `KLiK POS Coupon` | Regular | klik_pos |
| `KLiK POS Coupon Applicable Customer` | Child | klik_pos |
| `KLiK POS Coupon Applicable Item` | Child | klik_pos |
| `KLiK Gift Card` | Regular | klik_pos |
| `KLiK Gift Card Transaction` | Child | klik_pos |
| `KLiK POS Shift` | Regular | klik_pos |
| `KLiK Shift Cash Movement` | Child | klik_pos |
| `KLiK Shift Payment Summary` | Child | klik_pos |
| `KLiK POS Draft Order` | Regular | klik_pos |
| `KLiK POS Offline Queue` | Regular | klik_pos |
| `KLiK Loyalty Program` | Regular | klik_pos |
| `KLiK Loyalty Tier` | Child | klik_pos |
| `KLiK Customer Loyalty Points` | Regular | klik_pos |
| `KLiK Loyalty Transaction` | Child | klik_pos |
| `KLiK Customer Display Config` | Regular | klik_pos |
| `KLiK Customer Display Slide` | Child | klik_pos |
| `KLiK PoS Settings` | Single | klik_pos |

### Hooks الجديدة في `klik_pos/hooks.py`

```python
doc_events = {
    "POS Invoice": {
        "on_submit": [
            "klik_pos.api.offers.record_offer_usage",
            "klik_pos.api.offers.apply_coupon",
            "klik_pos.api.gift_cards.finalize_gift_card_redemption",
            "klik_pos.api.loyalty.post_sale_earn",
            "klik_pos.api.shift.update_shift_totals",
            "klik_pos.api.payment_fee.process_invoice_fees",        # من M سابق
            "klik_pos.api.salesperson.link_invoice_to_sp_order",    # من M سابق
        ],
        "on_cancel": [
            "klik_pos.api.offers.reverse_offer_usage",
            "klik_pos.api.gift_cards.reverse_gift_card_redemption",
            "klik_pos.api.loyalty.reverse_points",
        ]
    }
}

scheduler_events = {
    "daily": [
        "klik_pos.api.offers.deactivate_expired_offers",
        "klik_pos.api.gift_cards.expire_gift_cards",
        "klik_pos.api.loyalty.expire_old_points",
        "klik_pos.api.drafts.cleanup_expired_drafts",
    ]
}
```

---

## 11. ملخص تنفيذي وجدول زمني

### الجدول الزمني الكامل

| الـ Milestone | الميزة | المكونات الرئيسية | الجهد |
|--------------|--------|-------------------|-------|
| **M1** | Offers & Coupons Engine | KLiK POS Offer + KLiK POS Coupon + API + Frontend | 5 أيام |
| **M2** | Gift Cards | KLiK Gift Card + API + Payment Dialog | 3 أيام |
| **M3** | Enhanced Shift | KLiK POS Shift + Cash Movements + Closing UI | 4 أيام |
| **M4** | Hold Orders | KLiK POS Draft Order + API + Hold Panel | 3 أيام |
| **M5** | Offline-First | Service Worker + Dexie + Web Workers + PWA | 5 أيام |
| **M6** | Loyalty Program | 3 DocTypes + API + UI | 4 أيام |
| **M7** | Customer Display | Config DocType + Display Screen + WS | 3 أيام |
| **M8** | UX & Performance | Virtual Scroll + Shortcuts + Settings DocType | 3 أيام |
| **Testing** | UAT + Bug Fixes | — | 4 أيام |
| **المجموع** | — | **23 DocType جديدة** | **~34 يوم** |

### ترتيب التنفيذ المقترح حسب القيمة التجارية

```
الأولوية 1 (فوري):   M1 → M4 → M3   ← أعلى أثر على المبيعات اليومية
الأولوية 2 (قريب):   M2 → M6         ← زيادة الإيرادات والولاء
الأولوية 3 (متوسط):  M5 → M8         ← استقرار وأداء
الأولوية 4 (لاحق):   M7              ← تجربة العميل
```

### المبادئ الثابتة

1. **كل التطوير يتم داخل تطبيقات KLiK** — لا تطبيقات خارجية
2. **Fixtures للـ Custom Fields** — لا تعديل مباشر لـ DocTypes الموجودة
3. **Hooks على POS Invoice** — لا override لمنطق KLiK
4. **Zustand Stores مستقلة** — لا تداخل مع stores الموجودة
5. **ZATCA-safe** — كل الخصومات تُسجَّل بشكل صحيح في POS Invoice

---

> **ملاحظة:** بعد اكتمال هذه الخطة مع خطة الميزات السابقة (Dimensional Products + Salesperson Mode + Payment Collection Fee)، سيمتلك KLiK PoS منظومة متكاملة تتفوق على POSNext — مع الحفاظ على ZATCA Compliance الكاملة.
