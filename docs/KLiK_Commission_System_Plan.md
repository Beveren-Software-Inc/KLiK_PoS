# خطة نظام عمولة البياعين — KLiK PoS

**المرجع:** KLiK PoS + ERPNext v15 + Frappe HR
**التاريخ:** مارس 2026
**المبدأ:** استخدام كل ما هو موجود في ERPNext + بناء ما ينقص في تطبيقي `klik_pos` و `klik_spa`

---

## جدول المحتويات

1. [تحليل ما هو موجود في ERPNext والفجوات](#1-تحليل-ما-هو-موجود-في-erpnext-والفجوات)
2. [تعريف نموذج العمولة المطلوب](#2-تعريف-نموذج-العمولة-المطلوب)
3. [M1 — DocType: قاعدة العمولة (Commission Rule)](#3-m1--doctype-قاعدة-العمولة-commission-rule)
4. [M2 — محرك الحساب (Calculation Engine)](#4-m2--محرك-الحساب-calculation-engine)
5. [M3 — سجل العمولة (Commission Ledger)](#5-m3--سجل-العمولة-commission-ledger)
6. [M4 — التكامل مع Frappe HR وكشف الراتب](#6-m4--التكامل-مع-frappe-hr-وكشف-الراتب)
7. [M5 — التقارير والإحصائيات](#7-m5--التقارير-والإحصائيات)
8. [M6 — واجهة البياع في KLiK POS](#8-m6--واجهة-البياع-في-klik-pos)
9. [الحالات الحدية والأسئلة الجوهرية](#9-الحالات-الحدية-والأسئلة-الجوهرية)
10. [ملخص DocTypes والملفات الجديدة](#10-ملخص-doctypes-والملفات-الجديدة)
11. [الجدول الزمني](#11-الجدول-الزمني)

---

## 1. تحليل ما هو موجود في ERPNext والفجوات

### ✅ ما يوفره ERPNext v15 نيتفاً

| الميزة | الـ DocType | ملاحظات |
|--------|-------------|---------|
| **Sales Person** | `Sales Person` (Tree) | مرتبط بـ Employee، هيكل هرمي |
| **ربط البياع بالفاتورة** | `Sales Team` (Child Table) | في POS Invoice / Sales Invoice |
| **نسبة المساهمة** | `allocated_percentage` في Sales Team | نسبة مشاركة البياع في الفاتورة |
| **commission_rate** | `commission_rate` في Sales Team | نسبة عمولة على مستوى الفاتورة فقط |
| **Contribution to Net Total** | `contribution_to_net_total` | محسوب = Net Total × allocated% |
| **أهداف البياع** | `Sales Person Target` (Child) | هدف كمية/مبلغ لكل فترة |
| **تقرير مبيعات البياعين** | `Sales Person-wise Transaction Summary` | موجود في ERPNext Reports |
| **Sales Partner Commission** | `Sales Partner` | للشركاء الخارجيين — نسبة ثابتة على Net Total |

### ❌ ما لا يوجد في ERPNext ويجب بناؤه

| الميزة المفقودة | السبب |
|----------------|-------|
| **العتبة (Threshold)** | ERPNext لا يحسب عمولة فقط على المبيعات التي تجاوزت مبلغاً معيناً |
| **شرائح العمولة (Tiers)** | لا يوجد دعم لنسب مختلفة حسب bands (0-5000: 0%، 5000-10000: 2%...) |
| **الحساب على Net بعد الضريبة** | ERPNext يحسب على `net_total` (قبل الضريبة)، نحتاج `grand_total - tax_amount` |
| **حساب دوري تلقائي** | لا يوجد — يحتاج manual أو custom scheduler |
| **سجل عمولة مستقل** | لا يوجد DocType مخصص للعمولة المستحقة لكل بياع |
| **الموافقة على العمولة** | لا يوجد workflow للموافقة قبل الصرف |
| **ربط بكشف الراتب** | الـ `incentives` في Sales Team موجود لكن غير مرتبط بـ Salary Slip تلقائياً |
| **تتبع حالة الصرف** | لا يعرف البياع هل تم صرف عمولته أم لا |

### الاستنتاج

> **نستخدم من ERPNext:** `Sales Person`، `Sales Team` في POS Invoice، `Sales Person Target`، وتقرير `Sales Person-wise Transaction Summary` كأساس للبيانات.
>
> **نبني في `klik_pos`:** قاعدة العمولة، محرك الحساب، سجل العمولة، ربط كشف الراتب، التقارير المتقدمة.

---

## 2. تعريف نموذج العمولة المطلوب

### 2.1 منطق الحساب الأساسي

```
أساس الحساب = صافي مبيعات البياع خلال الفترة (بعد خصم الضريبة)
            = مجموع (grand_total - total_taxes_and_charges) لكل فاتورة
            = مجموع net_total لكل فاتورة مرتبطة بالبياع

العمولة المستحقة = تُحسب فقط على المبلغ الذي يتجاوز العتبة
```

### 2.2 مثال توضيحي — نماذج العمولة الثلاثة

**النموذج A — عتبة بسيطة (Simple Threshold):**
```
العتبة: 5,000 ريال
النسبة: 3%
أساس: Net Total (بعد الضريبة)

بياع باع 8,000 ريال:
  → المبلغ الخاضع للعمولة = 8,000 - 5,000 = 3,000 ريال
  → العمولة = 3,000 × 3% = 90 ريال
```

**النموذج B — شرائح تصاعدية (Progressive Tiers):**
```
الشريحة 1: 0 → 5,000       = 0%
الشريحة 2: 5,001 → 10,000  = 2%
الشريحة 3: 10,001+          = 4%

بياع باع 12,000 ريال:
  → شريحة 1: 5,000 × 0%  = 0
  → شريحة 2: 5,000 × 2%  = 100 ريال
  → شريحة 3: 2,000 × 4%  = 80 ريال
  → الإجمالي = 180 ريال
```

**النموذج C — نسبة ثابتة على الكل بعد العتبة (Flat on Total):**
```
العتبة: 5,000 ريال
النسبة: 3%

بياع باع 8,000 ريال:
  → تجاوز العتبة؟ نعم
  → العمولة = 8,000 × 3% = 240 ريال  ← على المبلغ الكلي وليس الفرق
```

### 2.3 الفترة الزمنية للحساب

| الخيار | الوصف |
|--------|-------|
| **يومي** | يُحسب كل يوم (غير شائع) |
| **أسبوعي** | يُحسب كل أسبوع |
| **شهري** *(الأكثر شيوعاً)* | يُحسب كل نهاية شهر |
| **ربع سنوي** | كل 3 أشهر |
| **يدوي** | المدير يُشغّل الحساب متى أراد |

---

## 3. M1 — DocType: قاعدة العمولة (Commission Rule)

### 3.1 `KLiK Commission Rule` — Single DocType (Per Salesperson)

> **ملاحظة:** يمكن إنشاء قاعدة لكل بياع، أو قاعدة افتراضية تسري على الجميع.

#### Schema الكاملة

| Field | Type | الوصف |
|-------|------|-------|
| `rule_name` | Data | اسم القاعدة (مثال: "قاعدة مبيعات 2026") |
| `is_active` | Check | تفعيل/تعطيل القاعدة |
| `applies_to` | Select | `All Salespersons / Specific Salesperson / Sales Group` |
| `sales_person` | Link → Sales Person | البياع المحدد (إن كان Specific) |
| `sales_group` | Link → Sales Person (Group) | مجموعة البياعين |
| `pos_profiles` | Table → KLiK CR POS Profile | نقاط البيع المُطبَّق عليها (فارغ = الكل) |
| `commission_model` | Select | `Threshold / Progressive Tiers / Flat on Total` |
| `calculation_basis` | Select | `Net Total (Excl. Tax) / Grand Total (Incl. Tax)` |
| `threshold_amount` | Currency | المبلغ الأدنى للاستحقاق (لـ Threshold + Flat) |
| `flat_rate` | Percent | النسبة الثابتة (لـ Threshold + Flat models) |
| `tiers` | Table → KLiK Commission Tier | شرائح العمولة (لـ Progressive) |
| `calculation_period` | Select | `Daily / Weekly / Monthly / Quarterly / Manual` |
| `calculation_day` | Int | يوم الحساب (مثال: 1 = أول الشهر، 30 = آخره) |
| `include_returns` | Check | هل تُخصم المرتجعات؟ (افتراضي: نعم) |
| `include_cancelled` | Check | هل تُحسب الفواتير الملغاة؟ (افتراضي: لا) |
| `min_invoice_amount` | Currency | الحد الأدنى للفاتورة المُحتسبة (لاستثناء الفواتير الصغيرة) |
| `effective_from` | Date | تاريخ بدء تطبيق القاعدة |
| `effective_to` | Date | تاريخ انتهاء القاعدة (فارغ = مفتوح) |
| `item_groups` | Table → KLiK CR Item Group | مجموعات الأصناف المُحتسبة (فارغ = الكل) |
| `excluded_items` | Table → KLiK CR Excluded Item | أصناف مستثناة من العمولة |
| `approval_required` | Check | هل تحتاج العمولة لموافقة قبل الصرف؟ |
| `approver` | Link → User | المسؤول عن الموافقة |
| `payment_method` | Select | `Add to Salary / Separate Payment / Manual` |
| `additional_salary_type` | Link → Additional Salary Component | مكوّن الراتب (لـ Frappe HR) |
| `notes` | Text | ملاحظات |

### 3.2 `KLiK Commission Tier` (Child Table)

| Field | Type | الوصف |
|-------|------|-------|
| `from_amount` | Currency | بداية الشريحة |
| `to_amount` | Currency | نهاية الشريحة (فارغ = ما لا نهاية) |
| `commission_rate` | Percent | نسبة العمولة لهذه الشريحة |
| `fixed_amount` | Currency | مبلغ ثابت إضافي (اختياري) |

**مثال:**
```
من 0        → 5,000      = 0%
من 5,001    → 10,000     = 2%
من 10,001   → ما لا نهاية = 4%
```

### 3.3 `KLiK Commission Rule` — Fixtures & Installation

```python
# klik_pos/fixtures/klik_commission_rule.json
# يُنشأ تلقائياً عند تثبيت klik_pos app

# after_install hook
def create_default_commission_rule():
    if not frappe.db.exists("KLiK Commission Rule", "Default Commission Rule"):
        doc = frappe.new_doc("KLiK Commission Rule")
        doc.rule_name = "Default Commission Rule"
        doc.applies_to = "All Salespersons"
        doc.commission_model = "Threshold"
        doc.calculation_basis = "Net Total (Excl. Tax)"
        doc.threshold_amount = 0
        doc.flat_rate = 0
        doc.calculation_period = "Monthly"
        doc.is_active = 0  # غير مفعّل حتى يضبطه المدير
        doc.insert(ignore_permissions=True)
```

---

## 4. M2 — محرك الحساب (Calculation Engine)

### 4.1 الملف: `klik_pos/api/commission.py`

```python
# klik_pos/api/commission.py

import frappe
from frappe.utils import flt, getdate, get_first_day, get_last_day, today
from dateutil.relativedelta import relativedelta


# ============================================================
# 1. دالة الحساب الرئيسية
# ============================================================

@frappe.whitelist()
def calculate_commission(
    sales_person,
    from_date,
    to_date,
    rule_name=None,
    preview_only=False
):
    """
    يحسب عمولة بياع لفترة محددة.
    preview_only=True: يُعيد النتيجة بدون حفظ في السجل
    """

    rule = get_applicable_rule(sales_person, rule_name)
    if not rule:
        return {"error": "لا توجد قاعدة عمولة مفعّلة لهذا البياع"}

    # جلب مبيعات البياع للفترة
    sales_data = get_salesperson_sales(sales_person, from_date, to_date, rule)

    net_sales      = sales_data["net_sales"]
    gross_sales    = sales_data["gross_sales"]
    returns_amount = sales_data["returns_amount"]
    invoice_count  = sales_data["invoice_count"]

    # تحديد أساس الحساب
    if rule.calculation_basis == "Net Total (Excl. Tax)":
        commission_base = net_sales
    else:
        commission_base = gross_sales

    # حساب العمولة حسب النموذج
    commission_amount, breakdown = apply_commission_model(rule, commission_base)

    result = {
        "sales_person":       sales_person,
        "rule_name":          rule.name,
        "from_date":          from_date,
        "to_date":            to_date,
        "gross_sales":        gross_sales,
        "net_sales":          net_sales,
        "returns_deducted":   returns_amount,
        "commission_base":    commission_base,
        "threshold_amount":   flt(rule.threshold_amount),
        "taxable_amount":     max(0, commission_base - flt(rule.threshold_amount))
                              if rule.commission_model == "Threshold" else commission_base,
        "commission_amount":  commission_amount,
        "commission_model":   rule.commission_model,
        "breakdown":          breakdown,
        "invoice_count":      invoice_count,
        "invoices":           sales_data["invoices"],
    }

    if not preview_only:
        save_commission_record(result, rule)

    return result


# ============================================================
# 2. جلب مبيعات البياع
# ============================================================

def get_salesperson_sales(sales_person, from_date, to_date, rule):
    """
    يجلب كل فواتير POS المرتبطة بالبياع خلال الفترة.
    يستخدم Sales Team child table الموجود في POS Invoice.
    """

    # فلتر الحد الأدنى للفاتورة
    min_inv = flt(rule.get("min_invoice_amount") or 0)

    # جلب الفواتير
    invoices = frappe.db.sql("""
        SELECT
            pi.name,
            pi.posting_date,
            pi.customer,
            pi.net_total,
            pi.grand_total,
            pi.total_taxes_and_charges,
            pi.is_return,
            st.allocated_percentage,
            st.contribution_to_net_total
        FROM `tabPOS Invoice` pi
        INNER JOIN `tabSales Team` st ON st.parent = pi.name
        WHERE
            pi.docstatus = 1
            AND pi.posting_date BETWEEN %(from_date)s AND %(to_date)s
            AND st.sales_person = %(sales_person)s
            AND pi.grand_total >= %(min_invoice)s
    """, {
        "from_date":     from_date,
        "to_date":       to_date,
        "sales_person":  sales_person,
        "min_invoice":   min_inv
    }, as_dict=True)

    # فلتر مجموعات الأصناف المحددة
    if rule.get("item_groups"):
        invoices = filter_by_item_groups(invoices, rule.item_groups)

    # استثناء الأصناف المستثناة
    if rule.get("excluded_items"):
        invoices = exclude_items(invoices, rule.excluded_items)

    # حساب الإجماليات مع مراعاة نسبة المساهمة
    net_sales    = 0
    gross_sales  = 0
    returns_amt  = 0

    for inv in invoices:
        contrib_pct = flt(inv.allocated_percentage) / 100

        if inv.is_return:
            if rule.get("include_returns", 1):
                returns_amt  += flt(inv.net_total)   * contrib_pct
                net_sales    -= flt(inv.net_total)   * contrib_pct
                gross_sales  -= flt(inv.grand_total) * contrib_pct
        else:
            net_sales   += flt(inv.net_total)   * contrib_pct
            gross_sales += flt(inv.grand_total) * contrib_pct

    return {
        "net_sales":      net_sales,
        "gross_sales":    gross_sales,
        "returns_amount": abs(returns_amt),
        "invoice_count":  len([i for i in invoices if not i.is_return]),
        "invoices":       invoices
    }


# ============================================================
# 3. تطبيق نموذج العمولة
# ============================================================

def apply_commission_model(rule, commission_base):
    """يُطبق النموذج المحدد ويُعيد (المبلغ، التفاصيل)"""

    model = rule.commission_model

    if model == "Threshold":
        return _calc_threshold(rule, commission_base)

    elif model == "Progressive Tiers":
        return _calc_progressive(rule, commission_base)

    elif model == "Flat on Total":
        return _calc_flat_on_total(rule, commission_base)

    return 0, []


def _calc_threshold(rule, base):
    """عمولة على المبلغ الزائد عن العتبة فقط"""
    threshold = flt(rule.threshold_amount)
    if base <= threshold:
        return 0, [{"label": f"لم يتجاوز العتبة ({threshold:,.2f})", "amount": 0, "rate": 0}]

    taxable = base - threshold
    rate    = flt(rule.flat_rate) / 100
    amount  = taxable * rate

    breakdown = [
        {"label": f"العتبة",                    "amount": threshold, "rate": 0},
        {"label": f"المبلغ الخاضع للعمولة",    "amount": taxable,   "rate": flt(rule.flat_rate)},
        {"label": "العمولة المستحقة",           "amount": amount,    "rate": None},
    ]
    return amount, breakdown


def _calc_progressive(rule, base):
    """شرائح تصاعدية — كل شريحة بنسبتها"""
    tiers    = sorted(rule.tiers, key=lambda t: flt(t.from_amount))
    total    = 0
    remaining = base
    breakdown = []

    for tier in tiers:
        if remaining <= 0:
            break

        from_amt = flt(tier.from_amount)
        to_amt   = flt(tier.to_amount) if tier.to_amount else float('inf')
        rate     = flt(tier.commission_rate) / 100
        fixed    = flt(tier.fixed_amount)

        tier_width = to_amt - from_amt if to_amt != float('inf') else remaining
        in_tier    = min(remaining, tier_width)

        if in_tier <= 0:
            continue

        tier_commission = (in_tier * rate) + fixed
        total          += tier_commission
        remaining      -= in_tier

        breakdown.append({
            "label":  f"شريحة {from_amt:,.0f} → {to_amt:,.0f}",
            "amount": in_tier,
            "rate":   flt(tier.commission_rate),
            "commission": tier_commission
        })

    return total, breakdown


def _calc_flat_on_total(rule, base):
    """نسبة ثابتة على المبلغ الكلي إذا تجاوز العتبة"""
    threshold = flt(rule.threshold_amount)
    if base <= threshold:
        return 0, [{"label": f"لم يتجاوز العتبة ({threshold:,.2f})", "amount": 0, "rate": 0}]

    rate   = flt(rule.flat_rate) / 100
    amount = base * rate

    breakdown = [
        {"label": "إجمالي المبيعات (تجاوز العتبة)", "amount": base, "rate": flt(rule.flat_rate)},
        {"label": "العمولة المستحقة",                "amount": amount, "rate": None},
    ]
    return amount, breakdown


# ============================================================
# 4. دوال مساعدة
# ============================================================

def get_applicable_rule(sales_person, rule_name=None):
    """يجلب القاعدة المنطبقة على البياع"""
    if rule_name:
        return frappe.get_doc("KLiK Commission Rule", rule_name)

    # قاعدة مخصصة للبياع
    rules = frappe.get_all("KLiK Commission Rule",
        filters={"is_active": 1, "applies_to": "Specific Salesperson",
                 "sales_person": sales_person},
        order_by="effective_from desc", limit=1)
    if rules:
        return frappe.get_doc("KLiK Commission Rule", rules[0].name)

    # قاعدة المجموعة
    group = frappe.db.get_value("Sales Person", sales_person, "parent_sales_person")
    if group:
        rules = frappe.get_all("KLiK Commission Rule",
            filters={"is_active": 1, "applies_to": "Sales Group", "sales_group": group},
            order_by="effective_from desc", limit=1)
        if rules:
            return frappe.get_doc("KLiK Commission Rule", rules[0].name)

    # القاعدة الافتراضية
    rules = frappe.get_all("KLiK Commission Rule",
        filters={"is_active": 1, "applies_to": "All Salespersons"},
        order_by="effective_from desc", limit=1)
    return frappe.get_doc("KLiK Commission Rule", rules[0].name) if rules else None


@frappe.whitelist()
def preview_commission(sales_person, from_date, to_date, rule_name=None):
    """معاينة العمولة بدون حفظ"""
    return calculate_commission(sales_person, from_date, to_date, rule_name, preview_only=True)


@frappe.whitelist()
def run_period_commission(period="Monthly", target_date=None):
    """
    Scheduler Job: يُشغَّل تلقائياً في نهاية كل فترة.
    يحسب عمولة جميع البياعين النشطين.
    """
    if not target_date:
        target_date = today()

    date = getdate(target_date)

    if period == "Monthly":
        from_date = get_first_day(date)
        to_date   = get_last_day(date)
    elif period == "Weekly":
        from_date = date - relativedelta(days=date.weekday())
        to_date   = from_date + relativedelta(days=6)
    elif period == "Quarterly":
        month_in_quarter = ((date.month - 1) % 3)
        from_date = get_first_day(date - relativedelta(months=month_in_quarter))
        to_date   = get_last_day(date + relativedelta(months=(2 - month_in_quarter)))

    # جلب كل البياعين النشطين
    sales_persons = frappe.get_all("Sales Person",
        filters={"enabled": 1, "is_group": 0},
        pluck="name")

    results = []
    for sp in sales_persons:
        try:
            result = calculate_commission(sp, from_date, to_date)
            results.append(result)
        except Exception as e:
            frappe.log_error(f"Commission calculation failed for {sp}: {e}")

    return results
```

### 4.2 Hook في `klik_pos/hooks.py`

```python
# klik_pos/hooks.py

scheduler_events = {
    # تشغيل حساب العمولة في اليوم الأول من كل شهر
    "monthly": [
        "klik_pos.api.commission.run_period_commission"
    ],
}

doc_events = {
    "POS Invoice": {
        "on_submit": [
            "klik_pos.api.commission.update_running_total",  # يحدّث الإجمالي الجاري للبياع
        ],
        "on_cancel": [
            "klik_pos.api.commission.reverse_running_total",
        ]
    }
}
```

### 4.3 Running Total — تتبع لحظي للمبيعات

```python
def update_running_total(doc, method):
    """
    يُحدّث مجموع مبيعات البياع الجاري في الوقت الفعلي.
    يُستخدم لعرض "أنت على بُعد X ريال من العمولة" في شاشة البياع.
    """
    current_month = get_first_day(today())

    for st_row in doc.get("sales_team") or []:
        sp = st_row.sales_person
        contrib = flt(st_row.allocated_percentage) / 100
        net_contribution = flt(doc.net_total) * contrib

        # جلب أو إنشاء سجل الشهر الحالي
        key = f"{sp}::{current_month}"
        existing = frappe.cache().get(key)

        if existing is None:
            # جلب من DB
            existing = get_month_running_total(sp, current_month)

        new_total = existing + net_contribution
        frappe.cache().set(key, new_total, expires_in_sec=3600)

        # تحديث في DB أيضاً
        update_commission_ledger_running(sp, doc.name, net_contribution, current_month)
```

---

## 5. M3 — سجل العمولة (Commission Ledger)

### 5.1 `KLiK Commission Ledger` — DocType

| Field | Type | الوصف |
|-------|------|-------|
| `naming_series` | Data | `COMM-.YYYY.-.MM.-####` |
| `sales_person` | Link → Sales Person | البياع |
| `employee` | Link → Employee | الموظف المرتبط |
| `rule` | Link → KLiK Commission Rule | القاعدة المطبقة |
| `period_from` | Date | بداية الفترة |
| `period_to` | Date | نهاية الفترة |
| `status` | Select | `Draft / Pending Approval / Approved / Paid / Cancelled` |
| `gross_sales` | Currency | إجمالي المبيعات |
| `returns_deducted` | Currency | المرتجعات المخصومة |
| `commission_base` | Currency | أساس حساب العمولة (net/gross حسب الإعداد) |
| `threshold_amount` | Currency | العتبة المطبقة |
| `taxable_amount` | Currency | المبلغ الخاضع للعمولة (= commission_base - threshold) |
| `commission_rate` | Percent | النسبة المطبقة (للـ flat models) |
| `commission_amount` | Currency | **العمولة المستحقة** |
| `invoice_count` | Int | عدد الفواتير |
| `calculation_breakdown` | JSON | تفاصيل الشرائح |
| `approval_note` | Text | ملاحظات المعتمد |
| `approved_by` | Link → User | المعتمد |
| `approval_date` | Date | تاريخ الاعتماد |
| `salary_slip` | Link → Salary Slip | كشف الراتب المرتبط |
| `additional_salary` | Link → Additional Salary | الراتب الإضافي المرتبط |
| `payment_date` | Date | تاريخ الصرف الفعلي |
| `invoices` | Table → KLiK Commission Invoice | الفواتير المُحتسبة |

### 5.2 `KLiK Commission Invoice` (Child Table)

| Field | Type | الوصف |
|-------|------|-------|
| `pos_invoice` | Link → POS Invoice | الفاتورة |
| `posting_date` | Date | تاريخ الفاتورة |
| `customer` | Data | العميل |
| `net_total` | Currency | Net Total للفاتورة |
| `grand_total` | Currency | Grand Total للفاتورة |
| `allocated_percentage` | Percent | نسبة مساهمة البياع |
| `contribution_amount` | Currency | حصة البياع |
| `is_return` | Check | هل هي مرتجع؟ |

### 5.3 Workflow لسجل العمولة

```
Draft → Pending Approval → Approved → Paid
           ↓
        Rejected → Cancelled
```

```python
# klik_pos/commission_workflow.py
# يُنشأ كـ Frappe Workflow

workflow = {
    "document_type": "KLiK Commission Ledger",
    "states": [
        {"state": "Draft",            "allow_edit": "Sales Manager"},
        {"state": "Pending Approval", "allow_edit": "Commission Approver"},
        {"state": "Approved",         "allow_edit": "Accounts Manager"},
        {"state": "Paid",             "allow_edit": ""},
        {"state": "Cancelled",        "allow_edit": ""},
    ],
    "transitions": [
        {"state": "Draft",            "action": "Submit for Approval", "next_state": "Pending Approval"},
        {"state": "Pending Approval", "action": "Approve",             "next_state": "Approved"},
        {"state": "Pending Approval", "action": "Reject",              "next_state": "Cancelled"},
        {"state": "Approved",         "action": "Mark as Paid",        "next_state": "Paid"},
    ]
}
```

---

## 6. M4 — التكامل مع Frappe HR وكشف الراتب

### 6.1 الطريقة الموصى بها: `Additional Salary`

ERPNext v15 يمتلك `Additional Salary` doctype — هذا أفضل طريقة لإضافة العمولة لكشف الراتب.

```python
# klik_pos/api/commission.py

@frappe.whitelist()
def create_additional_salary(commission_ledger_name):
    """
    ينشئ Additional Salary من سجل العمولة المعتمد
    ثم يربطها بـ Salary Slip تلقائياً عند إنشائه.
    """
    ledger = frappe.get_doc("KLiK Commission Ledger", commission_ledger_name)

    if ledger.status != "Approved":
        frappe.throw("يجب اعتماد سجل العمولة أولاً")

    if ledger.additional_salary:
        frappe.throw("تم إنشاء Additional Salary مسبقاً")

    # جلب الموظف من السيلز بيرسون
    employee = frappe.db.get_value("Sales Person", ledger.sales_person, "employee")
    if not employee:
        frappe.throw(f"البياع {ledger.sales_person} غير مرتبط بموظف في Frappe HR")

    # جلب مكوّن الراتب من القاعدة
    rule = frappe.get_doc("KLiK Commission Rule", ledger.rule)
    salary_component = rule.additional_salary_type or "Commission"

    add_sal = frappe.new_doc("Additional Salary")
    add_sal.employee          = employee
    add_sal.salary_component   = salary_component
    add_sal.amount             = ledger.commission_amount
    add_sal.payroll_date       = ledger.period_to
    add_sal.company            = frappe.defaults.get_user_default("Company")
    add_sal.overwrite_salary_structure_amount = 0
    add_sal.notes = f"عمولة مبيعات — {ledger.name} ({ledger.period_from} → {ledger.period_to})"
    add_sal.ref_doctype        = "KLiK Commission Ledger"
    add_sal.ref_docname        = ledger.name
    add_sal.insert()
    add_sal.submit()

    # ربط الـ Additional Salary بسجل العمولة
    frappe.db.set_value("KLiK Commission Ledger", ledger.name, {
        "additional_salary": add_sal.name,
        "status": "Paid"
    })

    return add_sal.name
```

### 6.2 `Salary Component` — إعداد مكوّن العمولة

```
Salary Component:
  Name:        Commission
  Type:        Earning (إيراد)
  Description: عمولة مبيعات شهرية
  Is Tax Applicable: حسب سياسة الشركة
```

### 6.3 تدفق الصرف الكامل

```
حساب العمولة
      ↓
KLiK Commission Ledger (Draft)
      ↓  [Submit for Approval]
Pending Approval
      ↓  [Approve] بواسطة المدير
Approved
      ↓  [Create Additional Salary]
Additional Salary (Submitted)
      ↓  [Run Payroll]
Salary Slip → يتضمن العمولة تلقائياً
      ↓
Status = Paid ✓
```

### 6.4 تكامل بديل — صرف مستقل بدون Payroll

لمن لا يستخدم Frappe HR Payroll:

```python
@frappe.whitelist()
def create_payment_entry(commission_ledger_name):
    """إنشاء قيد دفع مباشر للعمولة (Payment Entry)"""
    ledger = frappe.get_doc("KLiK Commission Ledger", commission_ledger_name)

    # إنشاء Journal Entry
    je = frappe.new_doc("Journal Entry")
    je.voucher_type = "Journal Entry"
    je.posting_date = today()
    je.user_remark  = f"عمولة بياع: {ledger.sales_person} — {ledger.name}"

    # DR: مصروف العمولة
    je.append("accounts", {
        "account":      "Commission Expense",   # يحدده المدير
        "debit_in_account_currency": ledger.commission_amount,
        "party_type":   "Employee",
        "party":        frappe.db.get_value("Sales Person", ledger.sales_person, "employee")
    })

    # CR: حساب الدفع
    je.append("accounts", {
        "account":     "Cash",   # أو البنك
        "credit_in_account_currency": ledger.commission_amount,
    })

    je.insert()
    return je.name
```

---

## 7. M5 — التقارير والإحصائيات

### 7.1 التقارير المطلوبة

#### تقرير 1: ملخص عمولات البياعين (Commission Summary)

```python
# klik_pos/report/commission_summary/commission_summary.py

def execute(filters=None):
    columns = [
        {"fieldname": "sales_person",     "label": "البياع",          "fieldtype": "Link", "options": "Sales Person"},
        {"fieldname": "employee",         "label": "الموظف",          "fieldtype": "Link", "options": "Employee"},
        {"fieldname": "period",           "label": "الفترة",          "fieldtype": "Data"},
        {"fieldname": "gross_sales",      "label": "إجمالي المبيعات",  "fieldtype": "Currency"},
        {"fieldname": "returns",          "label": "المرتجعات",        "fieldtype": "Currency"},
        {"fieldname": "commission_base",  "label": "أساس العمولة",    "fieldtype": "Currency"},
        {"fieldname": "threshold",        "label": "العتبة",          "fieldtype": "Currency"},
        {"fieldname": "taxable_amount",   "label": "المبلغ الخاضع",   "fieldtype": "Currency"},
        {"fieldname": "commission_rate",  "label": "النسبة %",         "fieldtype": "Percent"},
        {"fieldname": "commission_amount","label": "العمولة المستحقة", "fieldtype": "Currency", "bold": 1},
        {"fieldname": "status",           "label": "الحالة",          "fieldtype": "Data"},
        {"fieldname": "payment_date",     "label": "تاريخ الصرف",     "fieldtype": "Date"},
    ]
    # ...
```

#### تقرير 2: تتبع تقدم البياع نحو العتبة (Live Progress)

```python
@frappe.whitelist()
def get_salesperson_progress(sales_person, date=None):
    """
    يُعيد تقدم البياع نحو العتبة في الشهر الحالي.
    يُستخدم في واجهة البياع على الـ POS.
    """
    if not date:
        date = today()

    from_date = get_first_day(date)
    to_date   = date

    rule = get_applicable_rule(sales_person)
    if not rule:
        return None

    # حساب مبيعات الشهر حتى اليوم
    preview = calculate_commission(sales_person, from_date, to_date, preview_only=True)

    threshold = flt(rule.threshold_amount)
    current   = preview["commission_base"]
    progress  = min(100, (current / threshold * 100)) if threshold > 0 else 100
    remaining = max(0, threshold - current)

    return {
        "sales_person":       sales_person,
        "current_sales":      current,
        "threshold":          threshold,
        "remaining_to_threshold": remaining,
        "progress_percent":   progress,
        "is_above_threshold": current > threshold,
        "projected_commission": preview["commission_amount"],
        "days_remaining":     (get_last_day(date) - getdate(date)).days,
        "period":             f"{from_date} → {get_last_day(date)}",
    }
```

#### تقرير 3: مقارنة أداء البياعين (Leaderboard)

يُظهر جدول مقارنة بين البياعين مرتب تنازلياً حسب المبيعات والعمولة.

```python
@frappe.whitelist()
def get_commission_leaderboard(from_date, to_date, pos_profile=None):
    """ترتيب البياعين حسب المبيعات والعمولة للفترة"""
    # يجمع data من KLiK Commission Ledger + حسابات لحظية
    # ...
```

#### تقارير ERPNext الموجودة التي يجب الاستفادة منها

- `Sales Person-wise Transaction Summary` → استخدامها كـ drill-down
- `Sales Partner Commission` → للمقارنة إن تم إعداد البياعين كـ Sales Partners أيضاً

---

## 8. M6 — واجهة البياع في KLiK POS

### 8.1 ما يُضاف لشاشة البياع

#### شريط التقدم نحو العتبة (Commission Progress Bar)

```tsx
// klik_spa/src/components/salesperson/CommissionProgress.tsx

interface CommissionProgress {
  currentSales:     number;
  threshold:        number;
  progressPercent:  number;
  remainingToTarget: number;
  projectedCommission: number;
  isAboveThreshold: boolean;
}

export function CommissionProgressBar({ data }: { data: CommissionProgress }) {
  return (
    <div className="bg-background-dark rounded-lg p-3 border border-border-dark">

      {/* الهيدر */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-text-secondary">تقدمك نحو العمولة</span>
        <span className={cn(
          "text-xs font-bold px-2 py-0.5 rounded",
          data.isAboveThreshold
            ? "bg-emerald-500/10 text-emerald-500"
            : "bg-amber-500/10 text-amber-500"
        )}>
          {data.isAboveThreshold ? "✓ استحققت العمولة" : "لم تصل بعد"}
        </span>
      </div>

      {/* شريط التقدم */}
      <div className="h-2 w-full bg-surface-dark rounded-full overflow-hidden mb-2">
        <div
          className={cn("h-full rounded-full transition-all duration-500",
            data.isAboveThreshold ? "bg-emerald-500" : "bg-amber-500"
          )}
          style={{ width: `${data.progressPercent}%` }}
        />
      </div>

      {/* الأرقام */}
      <div className="flex justify-between text-xs">
        <div>
          <span className="text-text-secondary">مبيعاتك: </span>
          <span className="text-white font-bold">{formatCurrency(data.currentSales)}</span>
        </div>
        {!data.isAboveThreshold ? (
          <div>
            <span className="text-text-secondary">تبقى: </span>
            <span className="text-amber-500 font-bold">{formatCurrency(data.remainingToTarget)}</span>
          </div>
        ) : (
          <div>
            <span className="text-text-secondary">العمولة المتوقعة: </span>
            <span className="text-emerald-500 font-bold">{formatCurrency(data.projectedCommission)}</span>
          </div>
        )}
      </div>

    </div>
  );
}
```

#### عرض العمولة في "طلباتي اليوم"

في `MyOrdersPanel.tsx`:

```tsx
{/* في أعلى اللوحة */}
<div className="grid grid-cols-2 gap-3 mb-4">
  <StatCard label="مبيعاتي اليوم"    value={todaySales}    icon="payments" />
  <StatCard label="مبيعات الشهر"     value={monthSales}   icon="calendar_month" />
</div>

{/* شريط التقدم */}
<CommissionProgressBar data={commissionProgress} />
```

### 8.2 `useCommissionStore.ts`

```typescript
interface CommissionStore {
  progress:          CommissionProgress | null;
  myHistory:         CommissionLedger[];
  currentMonthSales: number;
  isLoading:         boolean;

  loadProgress:    () => Promise<void>;
  loadHistory:     () => Promise<void>;
  refreshOnSale:   () => void;  // يُستدعى بعد كل فاتورة ناجحة
}

// يُحدَّث كل 5 دقائق و بعد كل فاتورة
```

### 8.3 إشعار تجاوز العتبة

```tsx
// عند رفع فاتورة تُتجاوز بها العتبة للمرة الأولى هذا الشهر
// يُعرض toast notification:

toast.success(
  "🎉 تهانينا! تجاوزت العتبة وأصبحت مؤهلاً للعمولة هذا الشهر!",
  { duration: 5000 }
)
```

---

## 9. الحالات الحدية والأسئلة الجوهرية

### 9.1 أسئلة يجب الإجابة عليها قبل التنفيذ

| السؤال | الخيارات |
|--------|---------|
| **العتبة: هل تُحسب على فاتورة واحدة أم مجموع الشهر؟** | مجموع الشهر (الأشيع) |
| **البياع يعمل في أكثر من نقطة بيع: تُجمع المبيعات؟** | نعم / لكل نقطة منفصلة |
| **بياع شارك في فاتورة بنسبة 50%: العمولة على 50% فقط؟** | نعم — نستخدم `allocated_percentage` |
| **المرتجع في شهر مختلف: يُطرح من الشهر الحالي أم الماضي؟** | من الشهر الحالي (أبسط) |
| **هل العمولة خاضعة للضريبة؟** | حسب سياسة الشركة |
| **إذا ألغي البياع بعد استلام العمولة: استرداد؟** | Clawback policy |

### 9.2 حالات حدية في الحساب

| الموقف | الحل |
|--------|------|
| مرتجع يُرجع المبيعات تحت العتبة | يُعاد حساب العمولة تلقائياً — Clawback |
| بياع ترك العمل في منتصف الشهر | يُحسب نسبي حتى تاريخ المغادرة |
| فاتورة مشتركة بين بياعين | كل واحد يحصل عمولة على نسبته `allocated_percentage` |
| تغيير القاعدة في منتصف الشهر | تُطبق القاعدة الجديدة من بداية الشهر التالي فقط |
| بياع بلا `employee` في Frappe HR | يُعرض تحذير — يمكن الصرف يدوياً |
| صفر مبيعات في الشهر | لا يُنشأ Commission Ledger (أو يُنشأ بعمولة 0) |

### 9.3 مثال متكامل للتحقق من الحساب

```
البياع: أحمد محمد
الفترة: مارس 2026

الفواتير:
  INV-001: net_total = 3,500  ريال  (allocated 100%)
  INV-002: net_total = 4,000  ريال  (allocated 100%)
  INV-003: net_total = 2,000  ريال  (allocated 50%)  ← فاتورة مشتركة
  RET-001: net_total = -500   ريال  (مرتجع)

إجمالي النت لأحمد:
  = 3,500 + 4,000 + (2,000 × 50%) - 500
  = 3,500 + 4,000 + 1,000 - 500
  = 8,000 ريال

القاعدة: Threshold = 5,000، Rate = 3%

المبلغ الخاضع = 8,000 - 5,000 = 3,000 ريال
العمولة       = 3,000 × 3% = 90 ريال ✓
```

---

## 10. ملخص DocTypes والملفات الجديدة

### DocTypes الجديدة

| DocType | النوع | الوصف |
|---------|-------|-------|
| `KLiK Commission Rule` | Regular | قاعدة العمولة (النموذج + العتبة + الشرائح) |
| `KLiK Commission Tier` | Child | شرائح العمولة التصاعدية |
| `KLiK CR POS Profile` | Child | نقاط البيع المشمولة بالقاعدة |
| `KLiK CR Item Group` | Child | مجموعات الأصناف المحتسبة |
| `KLiK CR Excluded Item` | Child | الأصناف المستثناة |
| `KLiK Commission Ledger` | Regular + Workflow | سجل العمولة المحسوبة |
| `KLiK Commission Invoice` | Child | الفواتير المُحتسبة في السجل |

### ما يُستخدم من ERPNext بدون تعديل

| ما هو موجود | كيف نستخدمه |
|-------------|-------------|
| `Sales Person` | مرجع للبياع في كل DocTypes |
| `Sales Team` (Child في POS Invoice) | مصدر بيانات `allocated_percentage` |
| `Additional Salary` | طريقة صرف العمولة |
| `Salary Slip` | كشف الراتب الذي يشمل العمولة |
| `Sales Person Target` | يبقى للأهداف البيعية (منفصل عن العمولة) |

### ملفات Python الجديدة

```
klik_pos/
├── api/
│   └── commission.py              ← محرك الحساب الكامل
├── report/
│   ├── commission_summary/        ← تقرير ملخص العمولات
│   │   ├── commission_summary.py
│   │   └── commission_summary.json
│   └── commission_leaderboard/    ← تقرير الترتيب
├── doctype/
│   ├── klik_commission_rule/
│   ├── klik_commission_tier/
│   └── klik_commission_ledger/
└── hooks.py                       ← scheduler + doc_events
```

### ملفات TypeScript الجديدة

```
klik_spa/src/
├── components/salesperson/
│   ├── CommissionProgressBar.tsx
│   └── CommissionHistoryCard.tsx
├── store/
│   └── useCommissionStore.ts
└── views/
    └── CommissionReportView.tsx    ← صفحة تقرير للمدير
```

---

## 11. الجدول الزمني

| الـ Milestone | المحتوى | الجهد |
|--------------|---------|-------|
| **M1** | Commission Rule DocType + Tiers + Fixtures | 2 يوم |
| **M2** | Calculation Engine (3 نماذج) + Scheduler | 3 أيام |
| **M3** | Commission Ledger + Workflow + Clawback | 2 يوم |
| **M4** | Frappe HR Integration (Additional Salary + Payment) | 2 يوم |
| **M5** | تقارير (Summary + Leaderboard + Progress API) | 2 يوم |
| **M6** | Frontend (Progress Bar + Store + Notifications) | 2 يوم |
| **Testing** | سيناريوهات حساب + Edge Cases + UAT | 2 يوم |
| **المجموع** | | **~15 يوم** |

### ترتيب التنفيذ

```
M1 → M2 → M3 → M5 → M6 → M4
           ↑
     (الأكثر أهمية للمستخدم)
```

---

## ملاحظات الاستخدام الفوري من ERPNext

لو أردت حلاً سريعاً **قبل بناء النظام الكامل**، يمكن استخدام ERPNext مباشرة هكذا:

```
1. أضف Sales Person لكل فاتورة في الـ POS (Sales Team section)
2. اضبط allocated_percentage = 100% (أو حسب المشاركة)
3. شغّل تقرير "Sales Person-wise Transaction Summary"
4. صدّر Excel وأضف العمولة يدوياً
5. أنشئ Additional Salary يدوياً لكل بياع
```

هذا الحل المؤقت يعمل حتى اكتمال النظام المخصص.
