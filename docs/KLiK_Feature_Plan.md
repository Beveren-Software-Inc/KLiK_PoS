# KLiK PoS — خطة التطوير الشاملة

**Feature Plan: Dimensional Products · Salesperson Mode · Payment Collection Fee**
مارس 2026 | KLiK PoS · React 19 + TypeScript + Zustand | Frappe/ERPNext Python

---

## جدول المحتويات

1. [نظرة عامة وتحليل الكود](#1-نظرة-عامة-وتحليل-الكود)
2. [الميزة الأولى: البيع بالمقاس](#2-الميزة-الأولى-البيع-بالمقاس-dimensional-products)
3. [الميزة الثانية: وضع البياع](#3-الميزة-الثانية-وضع-البياع-salesperson-mode)
4. [الميزة الثالثة: نسبة تحصيل وسيلة الدفع](#4-الميزة-الثالثة-نسبة-تحصيل-وسيلة-الدفع-payment-collection-fee)
5. [التقارير والإحصائيات](#5-التقارير-والإحصائيات)
6. [خطة التنفيذ Milestones](#6-خطة-التنفيذ-milestones)
7. [حالات حدية وجوانب إضافية](#7-حالات-حدية-وجوانب-إضافية)
8. [ملاحظات تقنية](#8-ملاحظات-تقنية)
9. [ملخص تنفيذي](#9-ملخص-تنفيذي)

---

## 1. نظرة عامة وتحليل الكود

KLiK PoS هو نظام POS مبني على ERPNext باستخدام React 19 + TypeScript في الفرونت اند، Zustand للـ state management، وPython/Frappe في الباك اند.

### هيكل المشروع الحالي

| الطبقة | التقنية | الملفات الرئيسية |
|--------|---------|-----------------|
| Frontend SPA | React 19 + TypeScript + Vite | `klik_spa/src/` |
| State Management | Zustand stores | `klik_spa/src/store/` |
| Backend API | Frappe Python | `klik_pos/api/` |
| DocTypes | ERPNext + Custom | `klik_pos/doctype/` |
| Styling | Tailwind CSS | `tailwind.config.ts` |

### مبدأ التطوير

> يتم إدراج جميع هذه المميزات مباشرة في نظام **KLiK PoS**.
> Custom Fields عبر Frappe Fixtures فقط.

---

## 2. الميزة الأولى: البيع بالمقاس (Dimensional Products)

### 2.1 حالات الاستخدام

بعض المنتجات لا تُباع بالقطعة بل بالمساحة أو بالطول:

- لوح أكريليك **50×70 سم** — عدد 3 قطع
- فينيل طباعة **120×200 سم** — سعر لكل م²
- إطار معدني **30×40 سم** — قطعة بسعر ثابت
- خشب MDF **80 سم × أي طول** — سعر لكل متر طولي

### 2.2 أوضاع التسعير

| النوع | الحساب | مثال |
|-------|--------|------|
| `Unit` | `rate × qty` (الافتراضي) | علبة حبر = 50 ريال/قطعة |
| `Area` | `rate_per_m2 × (W×H / 10000) × qty` | أكريليك = 120 ريال/م² |
| `Linear` | `rate_per_m × (W / 100) × qty` | ألومنيوم = 45 ريال/م طولي |

### 2.3 الباك اند

#### 2.3.1 Custom Fields على `Item`

```json
// klik_pos/fixtures/custom_fields.json
[
  { "dt": "Item", "fieldname": "is_dimensional_product", "fieldtype": "Check" },
  { "dt": "Item", "fieldname": "pricing_mode", "fieldtype": "Select",
    "options": "Unit\nArea\nLinear" },
  { "dt": "Item", "fieldname": "dimension_unit", "fieldtype": "Select",
    "options": "cm\nmm\nm\ninch" },
  { "dt": "Item", "fieldname": "default_width",  "fieldtype": "Float" },
  { "dt": "Item", "fieldname": "default_height", "fieldtype": "Float" },
  { "dt": "Item", "fieldname": "min_width",  "fieldtype": "Float" },
  { "dt": "Item", "fieldname": "min_height", "fieldtype": "Float" },
  { "dt": "Item", "fieldname": "max_width",  "fieldtype": "Float" },
  { "dt": "Item", "fieldname": "max_height", "fieldtype": "Float" }
]
```

#### 2.3.2 Custom Fields على `POS Invoice Item`

```json
[
  { "dt": "POS Invoice Item", "fieldname": "custom_width",  "fieldtype": "Float" },
  { "dt": "POS Invoice Item", "fieldname": "custom_height", "fieldtype": "Float" },
  { "dt": "POS Invoice Item", "fieldname": "custom_area_m2", "fieldtype": "Float",
    "read_only": 1 },
  { "dt": "POS Invoice Item", "fieldname": "custom_pricing_mode", "fieldtype": "Data",
    "read_only": 1 }
]
```

#### 2.3.3 API جديد

```python
# klik_pos/api/dimensional.py

@frappe.whitelist()
def calculate_dimensional_price(item_code, width, height, qty, uom="cm"):
    """
    Returns calculated rate and amount based on item pricing_mode.
    width/height expected in 'uom' units, converted internally to meters.
    """
    item = frappe.get_doc("Item", item_code)
    w = to_meters(float(width), uom)
    h = to_meters(float(height), uom)
    q = float(qty)

    base_rate = get_item_price(item_code)  # from Item Price / Price List
    mode = item.get("pricing_mode") or "Unit"

    if mode == "Area":
        area_m2 = w * h
        rate     = base_rate * area_m2
        amount   = rate * q
        return {"rate": rate, "amount": amount, "area_m2": area_m2, "mode": mode}

    elif mode == "Linear":
        rate   = base_rate * w
        amount = rate * q
        return {"rate": rate, "amount": amount, "area_m2": None, "mode": mode}

    else:  # Unit
        return {"rate": base_rate, "amount": base_rate * q, "area_m2": None, "mode": "Unit"}


def to_meters(value, uom):
    return {"m": 1, "cm": 0.01, "mm": 0.001, "inch": 0.0254}.get(uom, 0.01) * value
```

### 2.4 الفرونت اند

#### 2.4.1 تعديل `CartItem` type

```typescript
// klik_spa/src/types/cart.ts
interface CartItem {
  // ... existing fields
  isDimensional?:   boolean;
  pricingMode?:     'Unit' | 'Area' | 'Linear';
  dimensionUnit?:   'cm' | 'mm' | 'm' | 'inch';
  width?:           number;
  height?:          number;
  calculatedArea?:  number;   // m²
  minWidth?:        number;
  maxWidth?:        number;
  minHeight?:       number;
  maxHeight?:       number;
}
```

#### 2.4.2 مكون `DimensionInput` (جديد)

Modal/Drawer يظهر تلقائياً عند إضافة منتج dimensional:

```
┌─────────────────────────────────────┐
│  لوح أكريليك — أدخل المقاسات       │
├─────────────────────────────────────┤
│  العرض (W)  [ 50  ] cm             │
│  الارتفاع (H) [ 70  ] cm  ← يُخفى في Linear │
│  الكمية      [  3  ]                │
├─────────────────────────────────────┤
│  المساحة: 0.35 م²                   │
│  السعر الإجمالي: 42.00 ريال         │
├─────────────────────────────────────┤
│  [ إلغاء ]         [ إضافة للسلة ] │
└─────────────────────────────────────┘
```

- تحقق لحظي من Min/Max
- استدعاء `calculate_dimensional_price` API عند كل تغيير
- دعم تعديل الأبعاد من داخل السلة (يُعيد الحساب)

#### 2.4.3 عرض في السلة وفي الفاتورة

```
│ لوح أكريليك                         │
│ 50 × 70 سم  ×3   →  0.35 م² × 3   │
│                        42.00 ريال   │
```

في Print Format: إضافة عمود **المقاس** في جدول المنتجات.

---

## 3. الميزة الثانية: وضع البياع (Salesperson Mode)

### 3.1 تعريف الأدوار

| الدور | الصلاحيات | ما لا يستطيع فعله |
|-------|-----------|------------------|
| **Salesperson** | إضافة منتجات، إنشاء طلب، إرسال للكاشير، متابعة طلباته، رؤية مبيعاته اليومية | تحصيل نقود، إغلاق shift، رؤية تقارير الآخرين، تعديل الأسعار |
| **Cashier** | رؤية الطلبات الواردة، قبول/رفض، تحصيل المبلغ، إغلاق shift | تعديل طلبات البياع بعد الإرسال |
| **Manager** | كل ما سبق + تقارير كل بياع + إعدادات العمولة | — |

### 3.2 DocTypes الجديدة

#### 3.2.1 `KLiK Salesperson Order`

| Field | Type | الوصف |
|-------|------|-------|
| `name` | Auto | رقم الطلب (SP-YYYY-XXXXX) |
| `salesperson` | Link → User | البياع |
| `salesperson_name` | Data (RO) | اسم البياع للعرض |
| `status` | Select | `Pending / Accepted / Rejected / Paid / Cancelled` |
| `pos_profile` | Link → POS Profile | نقطة البيع |
| `pos_opening_entry` | Link | ربط بالـ shift الحالي |
| `customer` | Link → Customer | العميل (اختياري) |
| `items` | Table → KLiK SP Order Item | المنتجات |
| `total_qty` | Float (RO) | إجمالي الكميات |
| `total_amount` | Currency (RO) | إجمالي المبلغ |
| `notes` | Text | ملاحظات البياع |
| `sent_at` | Datetime | وقت الإرسال |
| `accepted_at` | Datetime | وقت قبول الكاشير |
| `paid_at` | Datetime | وقت التحصيل |
| `pos_invoice` | Link → POS Invoice | الفاتورة بعد الدفع |
| `rejection_reason` | Text | سبب الرفض (إن وُجد) |

#### 3.2.2 `KLiK SP Order Item` (Child Table)

| Field | Type | الوصف |
|-------|------|-------|
| `item_code` | Link → Item | كود المنتج |
| `item_name` | Data | اسم المنتج |
| `qty` | Float | الكمية |
| `rate` | Currency | السعر الوحدوي |
| `amount` | Currency | الإجمالي |
| `width` | Float | العرض (dimensional) |
| `height` | Float | الارتفاع (dimensional) |
| `custom_area_m2` | Float | المساحة المحسوبة |
| `uom` | Link → UOM | وحدة القياس |

#### 3.2.3 `KLiK Salesperson Commission`

| Field | Type | الوصف |
|-------|------|-------|
| `salesperson` | Link → User | البياع |
| `pos_invoice` | Link → POS Invoice | الفاتورة |
| `sp_order` | Link → KLiK Salesperson Order | الطلب الأصلي |
| `sale_amount` | Currency | قيمة البيع |
| `commission_rate` | Percent | نسبة العمولة |
| `commission_amount` | Currency (RO) | مبلغ العمولة |
| `period` | Data | الفترة (YYYY-MM) |

### 3.3 الباك اند — API Endpoints

```python
# klik_pos/api/salesperson.py

@frappe.whitelist()
def create_sp_order(items, notes="", customer=None):
    """البياع يُنشئ طلب ويرسله للكاشير"""

@frappe.whitelist()
def get_pending_orders(pos_profile):
    """الكاشير يجلب الطلبات المعلقة على نقطة البيع"""

@frappe.whitelist()
def get_my_orders(date=None):
    """البياع يجلب طلباته (اليوم الحالي افتراضياً)"""

@frappe.whitelist()
def accept_sp_order(order_name):
    """الكاشير يقبل الطلب → يُعيد بيانات الطلب لتحميلها في السلة"""

@frappe.whitelist()
def reject_sp_order(order_name, reason):
    """الكاشير يرفض الطلب مع سبب"""

@frappe.whitelist()
def complete_sp_order(order_name, pos_invoice):
    """يُستدعى تلقائياً بعد تأكيد الفاتورة — يربط الطلب بالفاتورة"""

@frappe.whitelist()
def get_salesperson_report(from_date, to_date, salesperson=None):
    """تقرير مبيعات لكل بياع — للمدير"""

@frappe.whitelist()
def get_commission_summary(period):
    """ملخص العمولات الشهرية"""
```

#### Real-time Sync (WebSocket)

```python
# عند إرسال طلب جديد
frappe.publish_realtime(
    "new_sp_order",
    {"order": order_data},
    room=f"pos_cashier_{pos_profile}"
)

# عند قبول/رفض الطلب
frappe.publish_realtime(
    "sp_order_updated",
    {"order_name": order_name, "status": new_status, "reason": reason},
    room=f"salesperson_{salesperson_user}"
)
```

> **Fallback:** polling كل 5 ثوان إن لم يعمل WebSocket

#### Roles & Permissions

```
Frappe Roles:
  KLiK Salesperson → Create+Read (own) على KLiK Salesperson Order
  KLiK Cashier     → Read (all) + Write (status only) على KLiK Salesperson Order
  KLiK Manager     → Full Access على كل DocTypes الجديدة
```

### 3.4 الفرونت اند

#### 3.4.1 بنية شاشة البياع (`/salesperson`)

```
┌──────────────────────────────────────────────────────────┐
│  👤 أحمد محمد   |  طلبات اليوم: 7   |  المبيعات: 1,240 ريال  [Logout] │
├────────────────────────────┬─────────────────────────────┤
│                            │                             │
│   قائمة المنتجات (60%)     │   السلة الحالية (40%)      │
│   (نفس ItemList في POS)    │                             │
│                            │   [عناصر مختارة]           │
│                            │                             │
│                            │   الإجمالي: 350 ريال        │
│                            │                             │
│                            │  [ 🗑 مسح ]  [ 📤 إرسال ] │
├────────────────────────────┴─────────────────────────────┤
│  [ طلباتي اليوم ]                                        │
└──────────────────────────────────────────────────────────┘
```

#### 3.4.2 مكونات React الجديدة

```
klik_spa/src/
├── views/
│   └── SalespersonView.tsx        # الشاشة الرئيسية
├── components/salesperson/
│   ├── SalespersonCart.tsx        # سلة البياع (بدون Payment)
│   ├── SalespersonOrderCard.tsx   # بطاقة الطلب المرسل
│   └── MyOrdersPanel.tsx          # تاب "طلباتي اليوم"
└── store/
    └── useSalespersonStore.ts     # Zustand store
```

#### 3.4.3 `useSalespersonStore.ts`

```typescript
interface SalespersonStore {
  currentCart:      SPCartItem[];
  myOrders:         SPOrder[];
  todaySales:       number;
  addItem:          (item: SPCartItem) => void;
  removeItem:       (itemCode: string) => void;
  updateQty:        (itemCode: string, qty: number) => void;
  clearCart:        () => void;
  sendOrder:        (notes?: string) => Promise<void>;
  loadMyOrders:     () => Promise<void>;
  subscribeToUpdates: () => () => void;  // returns unsubscribe fn
}
```

#### 3.4.4 حالات الطلب (من جانب البياع)

| الحالة | اللون | ما يراه البياع |
|--------|-------|----------------|
| `Pending` | 🟡 أصفر | "في انتظار الكاشير..." |
| `Accepted` | 🔵 أزرق | "الكاشير قبل الطلب — جارٍ التحصيل" |
| `Paid` | 🟢 أخضر | "✓ تم الدفع بنجاح" |
| `Rejected` | 🔴 أحمر | "رُفض: [سبب الرفض]" |
| `Cancelled` | ⚫ رمادي | "تم الإلغاء" |

#### 3.4.5 لوحة الكاشير (Cashier Queue Panel)

إضافة Tab جديد في شاشة الكاشير الحالية **"طلبات البياعين"**:

```
┌────────────────────────────────────────────────────────┐
│  طلبات البياعين  🔴 3 معلّق                            │
├────────────────────────────────────────────────────────┤
│  👤 أحمد  │  3 منتجات  │  350 ريال  │  منذ 2 دقيقة   │
│  أكريليك 50×70 ×2, إطار 30×40 ×1                      │
│                    [ ✗ رفض ]  [ ✓ قبول وتحصيل ]      │
├────────────────────────────────────────────────────────┤
│  👤 محمود │  1 منتج   │  120 ريال  │  منذ 5 دقائق   │
│  ...                                                   │
└────────────────────────────────────────────────────────┘
```

#### 3.4.6 تدفق العمل الكامل

```
البياع                          الكاشير
  │                                │
  │── إنشاء طلب ──────────────────►│ (WebSocket notification)
  │                                │── يرى البطاقة في القائمة
  │◄── Pending ────────────────────│
  │                                │── يضغط "قبول"
  │◄── Accepted ───────────────────│── يُحمّل الطلب في السلة تلقائياً
  │                                │── يُكمل Payment dialog
  │◄── Paid ───────────────────────│── تُنشأ POS Invoice
  │    (مع رقم الفاتورة)           │── يُربط SP Order بالفاتورة
```

---

## 4. الميزة الثالثة: نسبة تحصيل وسيلة الدفع (Payment Collection Fee)

### 4.1 تعريف المشكلة

بعض وسائل الدفع تفرض رسوماً على المتجر (مثال: شبكة Mada 1.5%، Visa 2.5%، تحويل بنكي 0%). العميل (صاحب المتجر) يريد تحديد هذه النسبة لكل وسيلة دفع بحيث:

- **تُخصم** هذه النسبة من المبلغ الصافي الذي يستلمه المتجر
- تظهر كـ **رسوم تحصيل** مستقلة في تقارير المدير
- البائع والعميل لا يرونها في الفاتورة (شفافة للعميل النهائي)
- يمكن تفعيلها/تعطيلها لكل وسيلة دفع بشكل مستقل

### 4.2 مثال توضيحي

```
الفاتورة: 1,000 ريال
وسيلة الدفع: Visa (رسوم تحصيل: 2.5%)

المبلغ المستلم من العميل:  1,000.00 ريال
رسوم التحصيل (2.5%):         25.00 ريال
صافي ما يستلمه المتجر:       975.00 ريال

في التقارير:
  - إجمالي المبيعات:    1,000.00 ريال
  - إجمالي رسوم التحصيل:  25.00 ريال
  - صافي الإيرادات:       975.00 ريال
```

### 4.3 الباك اند

#### 4.3.1 Custom Fields على `Mode of Payment`

```json
// klik_pos/fixtures/custom_fields.json (إضافة لنفس الملف)
[
  {
    "dt": "Mode of Payment",
    "fieldname": "collection_fee_enabled",
    "fieldtype": "Check",
    "label": "تفعيل رسوم التحصيل",
    "default": "0"
  },
  {
    "dt": "Mode of Payment",
    "fieldname": "collection_fee_rate",
    "fieldtype": "Percent",
    "label": "نسبة رسوم التحصيل %",
    "depends_on": "eval:doc.collection_fee_enabled == 1",
    "precision": "4"
  },
  {
    "dt": "Mode of Payment",
    "fieldname": "fee_account",
    "fieldtype": "Link",
    "options": "Account",
    "label": "حساب رسوم التحصيل",
    "description": "الحساب المحاسبي الذي تُسجّل فيه الرسوم"
  },
  {
    "dt": "Mode of Payment",
    "fieldname": "fee_display_name",
    "fieldtype": "Data",
    "label": "اسم الرسوم في التقارير",
    "default": "رسوم تحصيل"
  }
]
```

#### 4.3.2 Custom Fields على `POS Payment Entry` / `POS Invoice Payment`

```json
[
  {
    "dt": "Sales Invoice Payment",
    "fieldname": "collection_fee_rate",
    "fieldtype": "Percent",
    "read_only": 1
  },
  {
    "dt": "Sales Invoice Payment",
    "fieldname": "collection_fee_amount",
    "fieldtype": "Currency",
    "read_only": 1
  },
  {
    "dt": "Sales Invoice Payment",
    "fieldname": "net_amount_after_fee",
    "fieldtype": "Currency",
    "read_only": 1
  }
]
```

#### 4.3.3 DocType جديد: `KLiK Payment Fee Log`

لتتبع جميع الرسوم المحصّلة:

| Field | Type | الوصف |
|-------|------|-------|
| `pos_invoice` | Link → POS Invoice | الفاتورة |
| `mode_of_payment` | Link → Mode of Payment | وسيلة الدفع |
| `invoice_amount` | Currency | مبلغ الفاتورة |
| `fee_rate` | Percent | النسبة المطبقة |
| `fee_amount` | Currency | مبلغ الرسوم |
| `net_amount` | Currency | الصافي بعد الخصم |
| `posting_date` | Date | تاريخ العملية |
| `pos_profile` | Link → POS Profile | نقطة البيع |
| `cashier` | Link → User | الكاشير |

#### 4.3.4 API جديد

```python
# klik_pos/api/payment_fee.py

@frappe.whitelist()
def get_payment_methods_with_fees(pos_profile):
    """
    يُعيد قائمة وسائل الدفع المتاحة لنقطة البيع مع بيانات الرسوم
    """
    methods = frappe.db.sql("""
        SELECT
            mop.name,
            mop.mode_of_payment,
            mop.collection_fee_enabled,
            mop.collection_fee_rate,
            mop.fee_display_name
        FROM `tabPOS Payment Method` ppm
        JOIN `tabMode of Payment` mop ON ppm.mode_of_payment = mop.name
        WHERE ppm.parent = %(pos_profile)s
    """, {"pos_profile": pos_profile}, as_dict=True)
    return methods


@frappe.whitelist()
def calculate_fee(mode_of_payment, amount):
    """
    يُعيد الرسوم والصافي لمبلغ ووسيلة دفع محددة
    """
    mop = frappe.get_doc("Mode of Payment", mode_of_payment)
    if not mop.get("collection_fee_enabled"):
        return {"fee_rate": 0, "fee_amount": 0, "net_amount": amount}

    rate       = flt(mop.collection_fee_rate) / 100
    fee_amount = flt(amount) * rate
    net_amount = flt(amount) - fee_amount

    return {
        "fee_rate":    mop.collection_fee_rate,
        "fee_amount":  fee_round(fee_amount),
        "net_amount":  fee_round(net_amount),
        "display_name": mop.fee_display_name or "رسوم تحصيل"
    }


@frappe.whitelist()
def log_payment_fee(pos_invoice, mode_of_payment, invoice_amount,
                    fee_rate, fee_amount, net_amount):
    """
    يُسجّل الرسوم في KLiK Payment Fee Log بعد تأكيد الفاتورة
    يُستدعى من on_submit hook على POS Invoice
    """
    doc = frappe.new_doc("KLiK Payment Fee Log")
    doc.update({...})
    doc.insert(ignore_permissions=True)

    # Journal Entry للقيد المحاسبي
    if frappe.db.get_single_value("KLiK PoS Settings", "auto_journal_for_fees"):
        create_fee_journal_entry(pos_invoice, mode_of_payment, fee_amount)
```

#### 4.3.5 Hook على `POS Invoice` (on_submit)

```python
# klik_pos/hooks.py
doc_events = {
    "POS Invoice": {
            "klik_pos.api.payment_fee.process_invoice_fees",
    }
}
```

### 4.4 الفرونت اند

#### 4.4.1 تعديل Payment Dialog

في شاشة الدفع الحالية، عند اختيار وسيلة دفع ذات رسوم تُظهر تلقائياً:

```
┌─────────────────────────────────────────────────┐
│  وسيلة الدفع: [  Visa  ▼  ]                    │
│                                                  │
│  المبلغ المطلوب:          1,000.00 ريال          │
│  ─────────────────────────────────────────────  │
│  رسوم التحصيل (2.5%):   ─ 25.00 ريال  ⚠️       │
│  ─────────────────────────────────────────────  │
│  صافي ما يستلمه المتجر:    975.00 ريال          │
│                                                  │
│  💡 رسوم التحصيل لا تظهر للعميل في الفاتورة    │
│                                                  │
│           [ إلغاء ]      [ تأكيد الدفع ]       │
└─────────────────────────────────────────────────┘
```

> الرسوم تُعرض للكاشير فقط — **لا تُضاف للفاتورة النهائية للعميل**.

#### 4.4.2 تعديل `usePaymentStore.ts`

```typescript
interface PaymentMethod {
  name:                string;
  mode_of_payment:     string;
  collection_fee_enabled: boolean;
  collection_fee_rate: number;
  fee_display_name:    string;
}

interface PaymentState {
  // ... existing fields
  selectedMethod?:     PaymentMethod;
  feeAmount:           number;    // الرسوم المحسوبة
  netAmount:           number;    // الصافي بعد الرسوم
  setPaymentMethod:    (method: PaymentMethod, amount: number) => void;
}
```

#### 4.4.3 Hook `useCollectionFee.ts`

```typescript
export function useCollectionFee(method: PaymentMethod | null, amount: number) {
  const [fee, setFee] = useState({ fee_amount: 0, net_amount: amount, fee_rate: 0 });

  useEffect(() => {
    if (!method?.collection_fee_enabled) {
      setFee({ fee_amount: 0, net_amount: amount, fee_rate: 0 });
      return;
    }
    // استدعاء API أو حساب محلي
    const rate       = method.collection_fee_rate / 100;
    const fee_amount = parseFloat((amount * rate).toFixed(2));
    setFee({ fee_amount, net_amount: amount - fee_amount, fee_rate: method.collection_fee_rate });
  }, [method, amount]);

  return fee;
}
```

#### 4.4.4 إعداد الرسوم من الكاشير (KLiK PoS Settings)

إضافة قسم في **KLiK PoS Settings**:

| الإعداد | النوع | الوصف |
|---------|-------|-------|
| `show_fee_to_cashier` | Check | إظهار الرسوم في شاشة الدفع |
| `auto_journal_for_fees` | Check | إنشاء قيد محاسبي تلقائي |
| `fee_cost_center` | Link → Cost Center | مركز التكلفة للرسوم |

### 4.5 الجانب المحاسبي

#### سيناريو: فاتورة 1,000 ريال — Visa (2.5%)

```
القيود المحاسبية (Journal Entry تلقائي):

DR  حساب العملاء / نقدية         1,000.00
    CR  إيرادات المبيعات          1,000.00

DR  رسوم تحصيل (مصروف)              25.00
    CR  حساب رسوم الشبكة              25.00
```

#### تقرير الإيرادات الصافية

```
إجمالي المبيعات:           10,000.00 ريال
رسوم Visa (2.5%):            -150.00 ريال
رسوم Mada (1.5%):             -45.00 ريال
رسوم نقد:                       0.00 ريال
─────────────────────────────────────────
صافي الإيرادات:              9,805.00 ريال
```

---

## 5. التقارير والإحصائيات

### 5.1 تقارير المدير

| التقرير | البيانات | الفترة |
|---------|----------|--------|
| مبيعات لكل بياع | الاسم + عدد الطلبات + إجمالي المبيعات | يومي/أسبوعي/شهري |
| ترتيب البياعين | ترتيب تنازلي حسب المبيعات + مخطط | أي فترة |
| تفاصيل طلبات البياع | كل طلب مع المنتجات والوقت والحالة | لكل بياع |
| العمولات المستحقة | نسبة × مبيعات = مبلغ لكل بياع | شهري |
| رسوم التحصيل | مجموع الرسوم لكل وسيلة دفع + الصافي | يومي/شهري |
| الإيرادات الصافية | المبيعات ناقص رسوم التحصيل الكلية | أي فترة |

### 5.2 تقارير البياع (من شاشته)

- إجمالي مبيعاته اليوم
- عدد الطلبات المكتملة / المعلقة / المرفوضة
- أعلى المنتجات التي يبيعها

---

## 6. خطة التنفيذ Milestones

### M1 — البنية التحتية (أسبوع 1)

- [ ] إعداد Custom Fields على `Item`, `POS Invoice Item`, `Mode of Payment`, `Sales Invoice Payment`
- [ ] إنشاء DocTypes الجديدة: `KLiK Salesperson Order`, `KLiK SP Order Item`, `KLiK Salesperson Commission`, `KLiK Payment Fee Log`
- [ ] إعداد Frappe Roles والصلاحيات
- [ ] كتابة Fixtures وتشغيلها
- [ ] إعداد WebSocket events في الباك اند
- [ ] إضافة قسم رسوم التحصيل في `KLiK PoS Settings`

### M2 — البيع بالمقاس (أسبوع 2)

- [ ] API: `calculate_dimensional_price` + unit conversion
- [ ] Frontend: مكون `DimensionInput`
- [ ] تعديل `useCartStore` لدعم `CartItem.dimensions`
- [ ] تعديل عرض Cart Items
- [ ] تعديل Print Format
- [ ] اختبار: 5 سيناريوهات (Area/Linear/Unit × تعديل من السلة × Min/Max validation)

### M3 — شاشة البياع (أسبوع 3)

- [ ] إنشاء `useSalespersonStore.ts`
- [ ] بناء `SalespersonView.tsx` + routing
- [ ] بناء `SalespersonCart.tsx` + `MyOrdersPanel.tsx`
- [ ] API: `create_sp_order`, `get_my_orders`
- [ ] WebSocket subscription في الفرونت (+ polling fallback)
- [ ] دعم Dimensional Products في شاشة البياع

### M4 — لوحة الكاشير ورسوم التحصيل (أسبوع 4)

- [ ] Cashier Orders Panel (Tab جديد)
- [ ] API: `get_pending_orders`, `accept_sp_order`, `reject_sp_order`
- [ ] تدفق: قبول الطلب → تحميل في السلة → دفع
- [ ] ربط الفاتورة بالطلب (`complete_sp_order` hook)
- [ ] API: `get_payment_methods_with_fees`, `calculate_fee`, `log_payment_fee`
- [ ] تعديل Payment Dialog لعرض رسوم التحصيل
- [ ] `useCollectionFee.ts` hook
- [ ] Hook on_submit على POS Invoice لتسجيل الرسوم + Journal Entry

### M5 — التقارير وصقل التجربة (أسبوع 5)

- [ ] تقارير مبيعات البياعين
- [ ] تقرير رسوم التحصيل
- [ ] تقرير الإيرادات الصافية
- [ ] Offline support: Dexie.js queue للطلبات
- [ ] تنبيه إغلاق shift إن وُجدت طلبات Pending
- [ ] Testing كامل + UAT

---

## 7. حالات حدية وجوانب إضافية

### 7.1 البيع بالمقاس

| الموقف | الحل |
|--------|------|
| تعديل أبعاد بعد الإضافة للسلة | إعادة استدعاء `calculate_dimensional_price` وتحديث السعر |
| أبعاد خارج نطاق Min/Max | رسالة خطأ فورية وعدم السماح بالإضافة |
| تحويل الوحدات (mm → cm) | دالة مركزية `to_meters()` في الباك اند |
| تأثير على ZATCA | السعر النهائي بعد الحساب هو ما يُرسل لـ ZATCA |
| منتج dimensional في طلب البياع | نفس `DimensionInput` Component يُعاد استخدامه |

### 7.2 وضع البياع

| الموقف | الحل |
|--------|------|
| Offline Mode | تخزين الطلب في Dexie.js ومزامنة عند العودة |
| إلغاء طلب من البياع | مسموح فقط في حالة `Pending` |
| تعديل طلب بعد الإرسال | ممنوع — يجب إلغاء وإنشاء جديد |
| منتج نفد من المخزن | التحقق من الـ stock عند `accept_sp_order` |
| طلبات معلقة عند إغلاق الـ Shift | تنبيه: "لديك X طلبات معلقة، هل تريد المتابعة؟" |
| Concurrent Orders | نفس Optimistic Lock المستخدم في KLiK |
| Multi-POS | الطلب يذهب للكاشير على نفس `POS Profile` فقط |
| ZATCA | الفاتورة تحمل `salesperson` كـ Sales Person field |

### 7.3 رسوم التحصيل

| الموقف | الحل |
|--------|------|
| تغيير وسيلة الدفع بعد عرض الرسوم | إعادة حساب فورية عند كل تغيير |
| دفع مختلط (Visa + نقد) | حساب الرسوم على حصة Visa فقط |
| رسوم صفرية | إخفاء قسم الرسوم تلقائياً |
| تقريب الرسوم | استخدام نفس قاعدة تقريب ERPNext (`precision`) |
| عدم إنشاء Journal Entry | اختيار `auto_journal_for_fees = false` في الإعدادات |
| استرداد (Credit Note) | عكس قيد الرسوم تلقائياً عند إنشاء Credit Note |

### 7.4 أمان وصلاحيات

- البياع لا يرى أسعار التكلفة أو هامش الربح
- البياع لا يستطيع تعديل أسعار المنتجات
- رسوم التحصيل لا تظهر للبياع ولا في فاتورة العميل
- لوج كامل لكل تغيير في حالة الطلب مع Timestamp وUser

---

## 8. ملاحظات تقنية

### 8.1 Database Indexes

```python
# تُضاف في after_install أو migrate
frappe.db.add_index("KLiK Salesperson Order", ["salesperson", "status"])
frappe.db.add_index("KLiK Salesperson Order", ["pos_opening_entry", "status"])
frappe.db.add_index("KLiK Salesperson Commission", ["salesperson", "period"])
frappe.db.add_index("KLiK Payment Fee Log", ["pos_invoice"])
frappe.db.add_index("KLiK Payment Fee Log", ["posting_date", "mode_of_payment"])
```

### 8.2 Zustand Stores الجديدة

```
useCartStore (موجود)      → إضافة حقول Dimensional
useSalespersonStore       → cart + orders للبياع (جديد)
useCashierQueueStore      → قائمة الطلبات الواردة للكاشير (جديد)
usePaymentStore (موجود)   → إضافة حقول Collection Fee
```

### 8.3 Frappe Hooks

```python
# klik_pos/hooks.py
doc_events = {
    "POS Invoice": {
        "on_submit": [
            "klik_pos.api.payment_fee.process_invoice_fees",
            "klik_pos.api.salesperson.link_invoice_to_sp_order",
            "klik_pos.api.salesperson.create_commission_record"
        ]
    }
}
```

---

## 9. ملخص تنفيذي

| الميزة | المكونات | الجهد |
|--------|---------|-------|
| Custom Fields + DocTypes + Roles | Fixtures + Python | 1.5 يوم |
| Dimensional Pricing (Backend) | API + hooks | 1 يوم |
| Dimensional Pricing (Frontend) | DimensionInput + Cart | 1.5 يوم |
| Salesperson Screen | View + Store + API | 3 أيام |
| Cashier Queue Panel | Component + API + WebSocket | 2 أيام |
| Payment Collection Fee (Backend) | API + Hook + Journal | 1.5 يوم |
| Payment Collection Fee (Frontend) | Dialog + Hook + Store | 1 يوم |
| Reports | Python + React | 2 أيام |
| Testing + Edge Cases + UAT | — | 2 أيام |
| **المجموع** | **5 Milestones** | **~15.5 يوم عمل** |

---

> **المبدأ الأساسي:** يتم تنفيذ كامل الكود والتعديلات مباشرة داخل `klik_pos` و `klik_spa` كجزء مدمج من النظام.
> جميع الميزات تتوافق مع ZATCA Phase 2 ومتطلبات ERPNext v15+.
