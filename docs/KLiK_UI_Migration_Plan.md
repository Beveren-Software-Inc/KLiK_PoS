# خطة الترحيل البصري — KLiK PoS

**المرجع:** 5 شاشات Stitch (Google) المصممة خصيصاً لـ KLiK PoS
**المبدأ:** تغيير بصري كامل مع الحفاظ على 100% من الوظائف الموجودة
**Stack:** React 19 + TypeScript + Tailwind CSS (موجود في KLiK)
**التاريخ:** مارس 2026

---

## جدول المحتويات

1. [نتائج التحليل — الفجوة البصرية الكاملة](#1-نتائج-التحليل--الفجوة-البصرية-الكاملة)
2. [Design Tokens الجديدة](#2-design-tokens-الجديدة)
3. [M1 — تهيئة الأساس (Design System Foundation)](#3-m1--تهيئة-الأساس-design-system-foundation)
4. [M2 — الشاشة الرئيسية للـ POS](#4-m2--الشاشة-الرئيسية-للـ-pos)
5. [M3 — إدارة الأصناف والخدمات](#5-m3--إدارة-الأصناف-والخدمات)
6. [M4 — لوحة Kanban الإنتاج](#6-m4--لوحة-kanban-الإنتاج)
7. [M5 — تفاصيل الطلب ومسار الإنتاج](#7-m5--تفاصيل-الطلب-ومسار-الإنتاج)
8. [M6 — إغلاق الوردية](#8-m6--إغلاق-الوردية)
9. [M7 — المكونات المشتركة (Shared Components)](#9-m7--المكونات-المشتركة-shared-components)
10. [ملخص المكونات والملفات المتأثرة](#10-ملخص-المكونات-والملفات-المتأثرة)
11. [الجدول الزمني](#11-الجدول-زمني)

---

## 1. نتائج التحليل — الفجوة البصرية الكاملة

### الشاشات التي تم تحليلها

| الملف | الشاشة | الوضع |
|-------|--------|-------|
| `saved_resource_copy_4.html` | **POS — نقطة البيع** | Dark only |
| `saved_resource.html` | **إدارة الأصناف والخدمات** | Dark only |
| `saved_resource_copy.html` | **Kanban الإنتاج** | Dark only |
| `saved_resource_copy_3.html` | **تفاصيل الطلب ومسار الإنتاج** | Light + Dark |
| `saved_resource_copy_2.html` | **إغلاق الوردية** | Light only |

### الفجوات الجوهرية بين KLiK الحالي والتصميم الجديد

| العنصر | KLiK الحالي | التصميم الجديد |
|--------|-------------|----------------|
| **لون الخلفية** | ألوان مختلطة (ليست dark-first) | `#111a22` dark-first موحّد |
| **Sidebar** | لا يوجد collapsible sidebar | Sidebar يتقلص `w-20` → يتمدد `w-64` عند hover |
| **موضع السلة في POS** | يمين الشاشة | يسار الشاشة — `w-[450px]` ثابت |
| **حقول الأبعاد في السلة** | Modal منفصل | مباشرة في بطاقة المنتج بـ grid 4 أعمدة |
| **تصفية الأصناف** | Tabs أفقية بسيطة | Scrollable tabs أفقية بتصميم مختلف |
| **بطاقة المنتج** | نص فقط / بدون صورة | صورة `h-32` + badge وحدة التسعير |
| **Header POS** | بسيط | h-16 + nav tabs + مؤشر الاتصال + user info |
| **Kanban** | غير موجود | 4 أعمدة مع color dots + glow + cards |
| **مسار الإنتاج** | غير موجود | 5 steps horizontal timeline |
| **Sidebar التنقل** | أيقونات بسيطة | `w-20 hover:w-64` مع تأثير transition |
| **جدول الأصناف** | جدول عادي | Progress bar للمخزون + status badge |
| **إغلاق الوردية** | صفحة ERPNext | صفحة نظيفة بـ light mode + big number input |
| **الخطوط** | Inter فقط | Inter + Noto Sans Arabic |
| **RTL** | جزئي | `dir="rtl" lang="ar"` كامل |
| **اتجاه التصميم** | LTR-first مُعكوس | RTL-native من الأساس |

---

## 2. Design Tokens الجديدة

### 2.1 تحديث `tailwind.config.ts`

```typescript
// klik_spa/tailwind.config.ts
export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Core Brand
        "primary":          "#137fec",
        "primary-hover":    "#0f6bd0",
        "primary-dark":     "#106ac4",

        // Backgrounds (Dark)
        "background-dark":  "#111a22",   // الخلفية العميقة
        "surface-dark":     "#1c2732",   // سطح البطاقات

        // Borders & Text (Dark)
        "border-dark":      "#2c3b4a",
        "text-secondary":   "#92adc9",

        // Backgrounds (Light)
        "background-light": "#f6f7f8",
      },
      fontFamily: {
        sans:    ['"Noto Sans Arabic"', '"Inter"', "sans-serif"],
        display: ['"Inter"', '"Noto Sans Arabic"', "sans-serif"],
        mono:    ['"Courier New"', "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",   // 4px
        lg:      "0.5rem",    // 8px
        xl:      "0.75rem",   // 12px
        "2xl":   "1rem",      // 16px
        full:    "9999px",
      },
    },
  },
}
```

### 2.2 CSS Variables في `index.css`

```css
/* klik_spa/src/index.css */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;600;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

:root {
  --color-primary:         #137fec;
  --color-primary-hover:   #0f6bd0;
  --color-bg-dark:         #111a22;
  --color-surface-dark:    #1c2732;
  --color-border-dark:     #2c3b4a;
  --color-text-secondary:  #92adc9;
}

/* Custom Scrollbar — Dark */
.custom-scroll::-webkit-scrollbar       { width: 6px; height: 6px; }
.custom-scroll::-webkit-scrollbar-track { background: #111a22; }
.custom-scroll::-webkit-scrollbar-thumb { background: #2c3b4a; border-radius: 3px; }
.custom-scroll::-webkit-scrollbar-thumb:hover { background: #3e5366; }

/* Hide scrollbar but keep functionality */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
```

### 2.3 HTML Root Tag

```html
<!-- public/index.html -->
<html class="dark" dir="rtl" lang="ar">
```

```typescript
// main.tsx — تطبيق dark class تلقائياً
document.documentElement.classList.add('dark')
document.documentElement.setAttribute('dir', 'rtl')
document.documentElement.setAttribute('lang', 'ar')
```

---

## 3. M1 — تهيئة الأساس (Design System Foundation)

### 3.1 الملفات المتأثرة

```
klik_spa/src/
├── index.css                    ← تحديث كامل (tokens + fonts + scrollbar)
├── tailwind.config.ts           ← تحديث colors + fonts + radius
├── main.tsx                     ← إضافة dark + rtl على html tag
└── components/ui/               ← مكونات مشتركة جديدة (انظر M7)
```

### 3.2 مكون `AppLayout.tsx` (جديد أو تعديل)

```
┌──────────────────────────────────────────────────────────────┐
│  Header (h-16, bg-surface-dark, border-b border-border-dark) │
├──────┬───────────────────────────────────────────────────────┤
│      │                                                       │
│  S   │   <main>                                             │
│  i   │   flex-1 overflow-hidden                             │
│  d   │   bg-background-dark                                 │
│  e   │                                                       │
│  b   │                                                       │
│  a   │                                                       │
│  r   │                                                       │
│      │                                                       │
└──────┴───────────────────────────────────────────────────────┘
```

---

## 4. M2 — الشاشة الرئيسية للـ POS

> **الملف المرجعي:** `saved_resource_copy_4.html`

### 4.1 التغييرات الجوهرية

| المكون | الحالة الحالية | الحالة المطلوبة |
|--------|----------------|-----------------|
| Layout | Cart يمين، Products يسار | **Cart يسار** `w-[450px]`، Products يمين `flex-1` |
| Header | بسيط بدون tabs | h-16 + nav tabs + مؤشر الاتصال + user |
| Cart Items | Modal للأبعاد | Grid 4 أعمدة مباشرة في البطاقة |
| Product Cards | نص فقط | صورة h-32 + badge وحدة + سعر |
| Category Filter | Tabs بسيطة | Horizontal scrollable tabs |
| Totals Footer | بسيط | shadowed footer مع تفاصيل كاملة |

### 4.2 هيكل الـ POS Header الجديد

```tsx
// POSHeader.tsx
<header className="h-16 shrink-0 border-b border-border-dark bg-surface-dark px-6 flex items-center justify-between">

  {/* الجانب الأيمن: Logo + Title + Status */}
  <div className="flex items-center gap-4">
    <KLiKLogo className="size-8 text-primary" />
    <h1 className="text-xl font-bold tracking-tight text-white">
      KLiK PoS
      <span className="text-sm font-medium text-text-secondary mx-2">نقطة البيع</span>
    </h1>
    <OnlineIndicator />  {/* مؤشر الاتصال */}
  </div>

  {/* الجانب الأيسر: Nav + Notifications + User */}
  <div className="flex items-center gap-4">
    <nav className="hidden md:flex items-center gap-6">
      <NavLink to="/dashboard">لوحة التحكم</NavLink>
      <NavLink to="/pos" active>نقطة البيع</NavLink>
      <NavLink to="/orders">الطلبات</NavLink>
      <NavLink to="/customers">العملاء</NavLink>
    </nav>
    <NotificationButton />
    <Divider />
    <UserMenu />
  </div>

</header>
```

### 4.3 مكون `OnlineIndicator.tsx` (جديد)

```tsx
// مؤشر الاتصال في هيدر الـ POS
<div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
  <div className={cn(
    "size-2 rounded-full",
    isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-400"
  )} />
  <span className={cn(
    "text-xs font-medium",
    isOnline ? "text-emerald-500" : "text-red-400"
  )}>
    {isOnline ? "متصل بالإنترنت" : `غير متصل — ${pendingCount} في الانتظار`}
  </span>
</div>
```

### 4.4 Layout الـ POS الجديد

```tsx
// POSView.tsx
<main className="flex-1 flex overflow-hidden">

  {/* ← اليسار: السلة (Cart) */}
  <section className="w-[450px] shrink-0 flex flex-col border-l border-border-dark bg-surface-dark relative z-10 shadow-xl">
    <CustomerSearch />
    <CartItemsList />      {/* قائمة عناصر السلة مع الأبعاد */}
    <CartFooter />         {/* المجاميع + أزرار الدفع */}
  </section>

  {/* → اليمين: كتالوج المنتجات */}
  <section className="flex-1 flex flex-col bg-background-dark">
    <SearchAndFilterBar />
    <CategoryTabs />
    <ProductsGrid />
  </section>

</main>
```

### 4.5 مكون `CartItem.tsx` — التصميم الجديد

```tsx
// بطاقة عنصر في السلة — مع الأبعاد مباشرة
<div className="bg-background-dark rounded-lg p-3 border border-border-dark group hover:border-primary/50 transition-colors">

  {/* اسم المنتج + زر الحذف */}
  <div className="flex justify-between items-start mb-2">
    <div>
      <h4 className="font-bold text-white text-sm">{item.name}</h4>
      <p className="text-xs text-text-secondary mt-0.5">رمز: {item.code}</p>
    </div>
    <button className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-400/10 p-1 rounded">
      <span className="material-symbols-outlined text-[18px]">delete</span>
    </button>
  </div>

  {/* Grid الأبعاد — 4 أعمدة */}
  {item.isDimensional ? (
    <div className="grid grid-cols-4 gap-2 mb-2">
      <DimensionField label="الطول (سم)" value={item.width} onChange={...} />
      <DimensionField label="العرض (سم)" value={item.height} onChange={...} />
      <DimensionField label="الكمية" value={item.qty} onChange={...} primary />
      <AreaDisplay area={item.area} />   {/* م² محسوبة */}
    </div>
  ) : (
    <div className="grid grid-cols-4 gap-2 mb-2">
      <div className="col-span-3">...</div>  {/* Qty فقط */}
    </div>
  )}

  {/* السعر */}
  <div className="flex justify-between items-center pt-2 border-t border-border-dark/50">
    <div className="text-xs text-text-secondary">
      سعر {item.pricingMode === 'Area' ? 'المتر' : 'الوحدة'}: {item.rate} ر.س
    </div>
    <div className="font-bold text-white">{item.amount} ر.س</div>
  </div>

</div>
```

### 4.6 مكون `ProductCard.tsx` — التصميم الجديد

```tsx
// بطاقة منتج في الكتالوج
<button className="flex flex-col text-right group bg-surface-dark rounded-xl overflow-hidden border border-border-dark hover:border-primary hover:shadow-lg hover:shadow-primary/10 transition-all duration-200">

  {/* صورة المنتج */}
  <div className="h-32 w-full bg-cover bg-center relative" style={{ backgroundImage: `url(${item.image})` }}>
    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
    {/* Badge وحدة التسعير */}
    <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded font-medium">
      {pricingModeLabel[item.pricingMode]}  {/* متر مربع / وحدة / باكت */}
    </span>
  </div>

  {/* محتوى البطاقة */}
  <div className="p-3 flex flex-col flex-1 w-full">
    <h3 className="text-sm font-bold text-white leading-tight group-hover:text-primary transition-colors mb-1">
      {item.name}
    </h3>
    <p className="text-xs text-text-secondary mb-3">{item.description}</p>
    <div className="mt-auto flex justify-between items-end w-full">
      <span className="text-primary font-bold">{item.rate}</span>
      <span className="text-[10px] text-text-secondary">ر.س / {item.unit}</span>
    </div>
  </div>

</button>
```

### 4.7 `CartFooter.tsx` — الإجماليات وأزرار الدفع

```tsx
<div className="bg-surface-dark border-t border-border-dark p-4 space-y-3 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">

  {/* تفاصيل المبالغ */}
  <FooterRow label="المجموع الفرعي" value={subtotal} />
  <FooterRow label="الضريبة (15%)" value={tax} />
  <FooterRow label="الخصم" value={discount} className="text-emerald-500" />
  <hr className="border-border-dark" />

  {/* الإجمالي */}
  <div className="flex justify-between items-end mb-2">
    <span className="font-bold text-white text-lg">الإجمالي</span>
    <div className="text-right">
      <span className="block text-2xl font-black text-primary leading-none">{total}</span>
      <span className="text-[10px] text-text-secondary uppercase">ريال سعودي</span>
    </div>
  </div>

  {/* أزرار العمل */}
  <div className="grid grid-cols-2 gap-3">
    <HoldButton />     {/* تعليق — bg-surface-dark border */}
    <PayButton />      {/* دفع سريع — bg-primary shadow */}
  </div>

</div>
```

### 4.8 `CategoryTabs.tsx`

```tsx
// Tabs أفقية scrollable للتصفية
<div className="px-4 pb-2 overflow-x-auto no-scrollbar">
  <div className="flex gap-2 min-w-max">
    {categories.map(cat => (
      <button
        key={cat.id}
        className={cn(
          "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
          active === cat.id
            ? "bg-primary text-white shadow-md shadow-primary/10"
            : "bg-surface-dark border border-border-dark text-text-secondary hover:bg-border-dark hover:text-white"
        )}
        onClick={() => setActive(cat.id)}
      >
        {cat.name}
      </button>
    ))}
  </div>
</div>
```

---

## 5. M3 — إدارة الأصناف والخدمات

> **الملف المرجعي:** `saved_resource.html`

### 5.1 التغييرات الجوهرية

| المكون | التصميم الجديد |
|--------|----------------|
| Layout | Sidebar + Header + Main |
| جدول الأصناف | صفوف rounded مع checkbox + thumbnail + progress bar + badge |
| Pagination | أزرار numbered مع primary highlight |
| Header الصفحة | عنوان + search + filter buttons + Add button |

### 5.2 بنية الـ Sidebar القابل للطي

```tsx
// AppSidebar.tsx
<aside className="hidden lg:flex w-20 hover:w-64 transition-all duration-300 flex-col bg-[#111a22] border-l border-border-dark group z-40 h-[calc(100vh-65px)] sticky top-[65px]">
  <nav className="flex flex-col gap-2 p-3">
    {navItems.map(item => (
      <NavItem key={item.path} {...item} />
    ))}
  </nav>
</aside>
```

```tsx
// NavItem.tsx — أيقونة تظهر دائماً، label يظهر عند hover على الـ sidebar
<a className={cn(
  "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group/item",
  isActive
    ? "bg-primary/10 text-primary"
    : "text-slate-400 hover:bg-surface-dark hover:text-white"
)}>
  <span className="material-symbols-outlined shrink-0">{item.icon}</span>
  {/* label يظهر فقط عند توسع الـ sidebar */}
  <span className="text-sm font-medium whitespace-nowrap overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity w-0 group-hover:w-auto">
    {item.label}
  </span>
</a>
```

### 5.3 `ItemsTable.tsx` — الجدول الجديد

```tsx
// صف في الجدول
<tr className="group">
  {/* Checkbox */}
  <td className="py-3 px-4 bg-surface-dark first:rounded-r-lg border-y border-r border-border-dark group-hover:border-primary/20">
    <input type="checkbox" className="form-checkbox rounded bg-background-dark border-border-dark text-primary" />
  </td>

  {/* الصنف: Thumbnail + Name + Code */}
  <td className="py-3 px-4 bg-surface-dark border-y border-border-dark">
    <div className="flex items-center gap-3">
      <div className="size-10 rounded bg-background-dark border border-border-dark flex items-center justify-center text-text-secondary">
        {item.image
          ? <img src={item.image} className="size-full object-cover rounded" />
          : <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
        }
      </div>
      <div>
        <div className="text-white font-medium text-sm">{item.name}</div>
        <div className="text-text-secondary text-xs font-mono mt-0.5">{item.code}</div>
      </div>
    </div>
  </td>

  {/* النوع: Badge ملون */}
  <td className="...">
    <div className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", typeColors[item.type])} />
      <span className="text-gray-300 text-sm">{item.typeLabel}</span>
    </div>
  </td>

  {/* الأبعاد */}
  <td className="...">
    <div className="flex flex-col gap-1">
      <span className="text-gray-300 text-sm">{item.dimensions}</span>
      <span className="text-text-secondary text-xs">{item.unit}</span>
    </div>
  </td>

  {/* السعر */}
  <td className="...">
    <span className="text-white font-mono font-medium">{item.price}</span>
    <span className="text-text-secondary text-xs mr-1">/ {item.unit}</span>
  </td>

  {/* المخزون: Progress Bar */}
  <td className="...">
    <div className="w-full max-w-[120px]">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white font-mono">{item.stock}</span>
        <span className="text-text-secondary">{item.unit}</span>
      </div>
      <div className="h-1.5 w-full bg-background-dark rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full", stockColor(item.stockPercent))}
          style={{ width: `${item.stockPercent}%` }}
        />
      </div>
    </div>
  </td>

  {/* الحالة: Status Badge */}
  <td className="...">
    <StatusBadge status={item.status} />
  </td>

  {/* الإجراءات */}
  <td className="... last:rounded-l-lg border-l">
    <button className="text-text-secondary hover:text-white p-1 rounded hover:bg-background-dark transition-colors">
      <span className="material-symbols-outlined text-[20px]">more_vert</span>
    </button>
  </td>
</tr>
```

### 5.4 `Pagination.tsx` الجديد

```tsx
<div className="flex items-center justify-between py-4 border-t border-border-dark mt-auto">
  <div className="text-xs text-text-secondary">
    عرض {from} إلى {to} من أصل {total} صنف
  </div>
  <div className="flex items-center gap-2">
    <PaginationArrow direction="prev" />
    {pages.map(p => (
      <PaginationPage key={p} page={p} active={p === currentPage} />
    ))}
    <PaginationArrow direction="next" />
  </div>
</div>
```

---

## 6. M4 — لوحة Kanban الإنتاج

> **الملف المرجعي:** `saved_resource_copy.html`

### 6.1 التصميم الجديد

```
┌──────────────────────────────────────────────────────────────────────┐
│  لوحة الإنتاج         [فلاتر] [إضافة بطاقة] [عرض: Kanban/List]    │
├─────────────────┬───────────────┬───────────────┬────────────────────┤
│  🟡 قيد الانتظار │  🔵 في الإنتاج │  🔴 مراجعة   │  🟢 جاهز للتسليم  │
│      (5)        │     (8)        │     (3)       │      (8)           │
├─────────────────┼───────────────┼───────────────┼────────────────────┤
│  [بطاقة طلب]    │  [بطاقة طلب]  │  [بطاقة طلب] │  [بطاقة طلب]      │
│  ...            │  ...          │  ...          │  ...               │
└─────────────────┴───────────────┴───────────────┴────────────────────┘
```

### 6.2 `KanbanColumn.tsx`

```tsx
<div className="flex flex-col w-80 shrink-0 h-full">

  {/* Column Header */}
  <div className="flex items-center justify-between mb-4 px-1">
    <div className="flex items-center gap-2">
      {/* Dot مع glow effect حسب اللون */}
      <div className={cn(
        "size-2 rounded-full",
        colorMap[column.color],
        `shadow-[0_0_8px_${glowColors[column.color]}]`
      )} />
      <h3 className="font-bold text-white text-sm">{column.title}</h3>
      <span className="bg-surface-dark text-text-secondary text-xs px-2 py-0.5 rounded-full border border-border-dark">
        {column.count}
      </span>
    </div>
    <button className="text-text-secondary hover:text-white">
      <span className="material-symbols-outlined text-[18px]">more_horiz</span>
    </button>
  </div>

  {/* Cards List */}
  <div className="flex-1 overflow-y-auto custom-scroll pr-1 pl-2 pb-2 flex flex-col gap-3">
    {column.cards.map(card => <KanbanCard key={card.id} card={card} color={column.color} />)}
  </div>

</div>
```

### 6.3 `KanbanCard.tsx`

```tsx
<div className={cn(
  "bg-surface-dark border border-border-dark rounded-xl p-4 shadow-sm",
  "hover:shadow-md transition-all cursor-pointer group relative overflow-hidden",
  `hover:border-${color}-500/30`
)}>

  {/* الشريط الجانبي الملون */}
  <div className={cn("absolute top-0 right-0 w-1 h-full", `bg-${color}-500`)} />

  {/* Header: رقم الطلب + الأيقونات */}
  <div className="flex justify-between items-start mb-3">
    <span className="text-xs font-mono text-text-secondary bg-background-dark px-1.5 py-0.5 rounded border border-border-dark">
      {card.orderId}
    </span>
    <PriorityBadge priority={card.priority} />
  </div>

  {/* اسم العميل والمنتج */}
  <h4 className="text-white font-bold text-base mb-1 leading-snug">{card.customer}</h4>
  <p className="text-text-secondary text-sm mb-3">{card.product}</p>

  {/* Metadata: التاريخ والموقع وغيره */}
  <div className="flex items-center gap-3 mb-4 text-xs text-text-secondary">
    <MetaBadge icon="calendar_today" value={card.deadline} />
    {card.location && <MetaBadge icon="inventory_2" value={card.location} color="green" />}
    {card.branch && <MetaBadge value={card.branch} color="blue" />}
  </div>

  {/* Progress Bar (إن وُجد) */}
  {card.progress && (
    <div className="mb-4">
      <div className="h-1 w-full bg-background-dark rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", `bg-${card.progressColor}-500`)}
             style={{ width: `${card.progress}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-text-secondary mt-1">
        <span>{card.progressLabel}</span>
        <span>{card.progress}%</span>
      </div>
    </div>
  )}

  {/* Action Button */}
  <button className={cn(
    "w-full py-1.5 rounded text-sm font-medium border border-border-dark transition-colors",
    `hover:bg-${color}-500/10 hover:text-${color}-500 hover:border-${color}-500/30`
  )}>
    {card.actionLabel}
  </button>

</div>
```

---

## 7. M5 — تفاصيل الطلب ومسار الإنتاج

> **الملف المرجعي:** `saved_resource_copy_3.html`

### 7.1 الأجزاء الرئيسية

```
┌──────────────────────────────────────────────────────────────────┐
│  [Breadcrumb] الطلبات > طلب #2458                               │
│  طلب #2458  🟡 قيد المعالجة  | التاريخ | العميل | القيمة       │
│                             [تعديل] [تحديث الحالة]             │
├──────────────────────────────────────────────────────────────────┤
│                     مسار الإنتاج (5 خطوات)                      │
│  ◉─────◉─────◎─────○─────○                                      │
│  استلام تأكيد إنتاج  تسليم                                     │
├──────────────────────────────────────────────────────────────────┤
│  عناصر الطلب (جدول)    │  معلومات العميل + الدفع (sidebar)     │
│                        │                                        │
│  أزرار الإجراءات (3×1) │  ملاحظات                               │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 مكون `ProductionTimeline.tsx` (جديد)

```tsx
// مسار الإنتاج — 5 خطوات أفقية
<div className="relative">
  {/* الخط الرابط الكامل — رمادي */}
  <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 dark:bg-[#111a22] -translate-y-1/2 rounded-full z-0" />
  {/* الخط المكتمل — primary */}
  <div className="absolute top-1/2 right-0 h-1 bg-primary -translate-y-1/2 rounded-full z-0"
       style={{ width: `${completedPercent}%` }} />

  {/* الخطوات */}
  <div className="relative z-10 flex justify-between w-full">
    {steps.map((step, i) => (
      <div key={i} className="flex flex-col items-center gap-2">
        <div className={cn(
          "size-10 rounded-full flex items-center justify-center border-4 border-white dark:border-surface-dark shadow-sm",
          step.status === 'completed' && "bg-primary text-white",
          step.status === 'current'   && "bg-amber-500 text-white shadow-lg shadow-amber-500/30 animate-pulse",
          step.status === 'pending'   && "bg-slate-200 dark:bg-[#111a22] text-slate-400 opacity-50"
        )}>
          <span className="material-symbols-outlined text-[18px]">{step.icon}</span>
        </div>
        <span className={cn(
          "text-xs font-medium text-center",
          step.status === 'pending' ? "text-slate-400 opacity-50" : "text-slate-700 dark:text-white"
        )}>
          {step.label}
        </span>
      </div>
    ))}
  </div>
</div>
```

### 7.3 شبكة أزرار الإجراءات (3 أعمدة)

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {actions.map(action => (
    <button key={action.id} className="flex flex-col items-center justify-center p-6 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-border-dark hover:border-primary hover:shadow-md transition-all group">
      <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-white transition-colors">
        <span className="material-symbols-outlined">{action.icon}</span>
      </div>
      <h4 className="font-bold text-slate-900 dark:text-white mb-1">{action.title}</h4>
      <p className="text-xs text-slate-500 dark:text-text-secondary text-center">{action.desc}</p>
    </button>
  ))}
</div>
```

---

## 8. M6 — إغلاق الوردية

> **الملف المرجعي:** `saved_resource_copy_2.html`

### 8.1 الملاحظات

هذه الصفحة تعمل بـ **Light Mode** فقط (بيضاء) — مختلفة عن باقي الشاشات.

### 8.2 بنية الصفحة

```
┌──────────────────────────────────────────────────────────────┐
│  Header (أبيض، شعار KLiK PoS)                               │
├──────────────────────────────────────────────────────────────┤
│              Summary Stats (ملخص الوردية)                    │
│    💰 إجمالي المبيعات  |  📄 الفواتير  |  ↩ المرتجعات       │
├──────────────────────────────────────────────────────────────┤
│  Card بيضاء:                                                  │
│    إجمالي النقد الفعلي في الدرج *                            │
│    [ input كبير placeholder="0.00"  ر.س ]                   │
│                                                               │
│    ملاحظات الإغلاق (اختياري)                                 │
│    [ textarea ]                                               │
│                                                               │
│    [ إلغاء ]     [ 🔒 إنهاء الوردية وإقفال الصندوق ]        │
├──────────────────────────────────────────────────────────────┤
│  جميع عمليات الإغلاق مسجلة ومراقبة. IP: xxx                 │
└──────────────────────────────────────────────────────────────┘
```

### 8.3 مكون `ShiftCloseForm.tsx`

```tsx
// الصفحة تُلف في light mode فقط (بدون class="dark")
<div className="min-h-screen bg-background-light flex flex-col">

  {/* Header أبيض */}
  <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
    <KLiKLogo className="size-8 text-primary" />
    <span className="text-lg font-bold text-slate-900">إغلاق الوردية</span>
  </header>

  <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">

    {/* ملخص الوردية */}
    <ShiftSummaryCards shift={currentShift} />

    {/* فورم الإغلاق */}
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
      <div className="flex flex-col gap-8">

        {/* حقل النقد — كبير جداً */}
        <div className="space-y-4">
          <label className="block text-base font-semibold text-slate-900">
            إجمالي النقد الفعلي في الدرج <span className="text-red-500">*</span>
          </label>
          <div className="relative max-w-lg">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <span className="text-slate-400 font-bold">ر.س</span>
            </div>
            <input
              type="number"
              placeholder="0.00"
              className="block w-full pr-14 pl-4 py-4 text-3xl font-bold text-slate-900 border-slate-300 rounded-lg focus:ring-primary focus:border-primary shadow-sm"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-slate-400">payments</span>
            </div>
          </div>
          <p className="text-sm text-slate-500">يرجى عد النقود بعناية...</p>
        </div>

        <hr className="border-slate-100" />

        {/* ملاحظات */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">ملاحظات الإغلاق (اختياري)</label>
          <textarea rows={3} className="block w-full border-slate-300 rounded-lg shadow-sm focus:border-primary focus:ring-primary resize-none text-sm" />
        </div>

        {/* أزرار */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <button className="px-6 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg">إلغاء</button>
          <button className="flex items-center gap-2 px-8 py-3 text-base font-bold text-white bg-primary rounded-lg shadow-lg hover:bg-blue-600 w-full md:w-auto">
            <span className="material-symbols-outlined">lock</span>
            إنهاء الوردية وإقفال الصندوق
          </button>
        </div>

      </div>
    </div>

    {/* Footer */}
    <div className="text-center mt-8 text-xs text-slate-400">
      <p>جميع عمليات الإغلاق مسجلة ومراقبة.</p>
    </div>
  </main>
</div>
```

---

## 9. M7 — المكونات المشتركة (Shared Components)

هذه المكونات تُستخدم في أكثر من شاشة وتُبنى مرة واحدة.

### 9.1 قائمة المكونات الجديدة

```
printhub/spa/src/components/ui/
├── StatusBadge.tsx          ← badge موحّد (متوفر، نفد، في الإنتاج...)
├── PriorityBadge.tsx        ← badge أولوية (عالية، متوسطة، عادية)
├── MetaBadge.tsx            ← badge أيقونة + نص في Kanban cards
├── DimensionField.tsx       ← حقل إدخال بُعد (label + input)
├── AreaDisplay.tsx          ← عرض المساحة المحسوبة (readonly)
├── ProgressBar.tsx          ← شريط تقدم المخزون/الإنتاج
├── OnlineIndicator.tsx      ← مؤشر الاتصال
├── NavItem.tsx              ← عنصر تنقل في الـ sidebar
├── FooterRow.tsx            ← صف في إجماليات السلة
├── Pagination.tsx           ← تصفح الصفحات
└── AppSidebar.tsx           ← الـ sidebar القابل للطي
```

### 9.2 `StatusBadge.tsx`

```tsx
const variants = {
  available:    "bg-green-500/10  text-green-500  border-green-500/20",
  out_of_stock: "bg-red-500/10    text-red-500    border-red-500/20",
  low_stock:    "bg-amber-500/10  text-amber-500  border-amber-500/20",
  in_progress:  "bg-blue-500/10   text-blue-500   border-blue-500/20",
  ready:        "bg-green-500/10  text-green-500  border-green-500/20",
  pending:      "bg-amber-500/10  text-amber-500  border-amber-500/20",
}

export function StatusBadge({ status }: { status: keyof typeof variants }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-1 rounded text-xs font-medium border",
      variants[status]
    )}>
      {statusLabels[status]}
    </span>
  )
}
```

### 9.3 مكتبة الأيقونات

المشروع يستخدم **Material Symbols Outlined** — يجب التأكد من أن الـ font محملة:

```html
<!-- في index.html -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
```

```tsx
// استخدام الأيقونة
<span className="material-symbols-outlined text-[20px]">search</span>
<span className="material-symbols-outlined text-[18px] fill-1">check_circle</span>
```

---

## 10. ملخص المكونات والملفات المتأثرة

### الملفات التي تحتاج تعديل في KLiK SPA

| الملف | نوع التعديل | الأثر |
|-------|-------------|-------|
| `tailwind.config.ts` | تحديث كامل للـ tokens | 🔴 عالي |
| `src/index.css` | fonts + scrollbar + variables | 🔴 عالي |
| `public/index.html` | dark + rtl + font links | 🔴 عالي |
| `src/views/POSView.tsx` | إعادة بناء Layout | 🔴 عالي |
| `src/components/CartItem.tsx` | تصميم جديد + grid الأبعاد | 🔴 عالي |
| `src/components/ProductCard.tsx` | صورة + badge + تصميم جديد | 🔴 عالي |
| `src/components/POSHeader.tsx` | h-16 + nav tabs + مؤشر | 🔴 عالي |
| `src/components/CategoryTabs.tsx` | scrollable tabs جديد | 🟠 متوسط |
| `src/components/CartFooter.tsx` | shadowed footer + total | 🟠 متوسط |
| `src/views/ItemsView.tsx` | جدول + sidebar | 🟠 متوسط |
| `src/components/AppSidebar.tsx` | جديد — w-20/w-64 collapsible | 🟠 متوسط |
| `src/views/KanbanView.tsx` | جديد كلياً | 🟡 منخفض |
| `src/views/OrderDetailsView.tsx` | timeline + layout | 🟡 منخفض |
| `src/views/ShiftCloseView.tsx` | light mode + big input | 🟡 منخفض |

### المكونات الجديدة التي تُنشأ

```
✅ AppSidebar.tsx
✅ OnlineIndicator.tsx
✅ ProductionTimeline.tsx
✅ KanbanBoard.tsx + KanbanColumn.tsx + KanbanCard.tsx
✅ StatusBadge.tsx + PriorityBadge.tsx + MetaBadge.tsx
✅ DimensionField.tsx + AreaDisplay.tsx
✅ ProgressBar.tsx
✅ Pagination.tsx
✅ NavItem.tsx + FooterRow.tsx
```

---

## 11. الجدول الزمني

| الـ Milestone | المحتوى | الجهد |
|--------------|---------|-------|
| **M1** | Design Tokens + tailwind + CSS + RTL | 1 يوم |
| **M2** | POS Screen كامل (Header + Layout + Cart + Products) | 4 أيام |
| **M3** | Items Management (Sidebar + Table + Pagination) | 3 أيام |
| **M4** | Kanban Board (Columns + Cards) | 2 يوم |
| **M5** | Order Details (Timeline + Grid Actions) | 2 يوم |
| **M6** | Shift Close (Light mode form) | 1 يوم |
| **M7** | Shared Components (Badge + Icons + Utils) | 2 يوم |
| **Testing** | Cross-browser + RTL + Dark mode + Responsive | 2 يوم |
| **المجموع** | | **~17 يوم** |

### ترتيب التنفيذ المقترح

```
M1 (أساس) → M7 (مكونات مشتركة) → M2 (POS) → M3 (Items) → M4 (Kanban) → M5+M6
```

---

## ملاحظات ختامية

1. **لا تغيير في الـ Store أو الـ API** — كل التغيير بصري فقط، الـ Zustand stores والـ Frappe APIs تبقى كما هي
2. **Dark Mode اجباري** — التصميم dark-first، الـ light mode فقط في صفحة إغلاق الوردية
3. **RTL-native** — كل المكونات تُكتب RTL من البداية بدلاً من عكس LTR
4. **Material Symbols** تستبدل أي أيقونات موجودة (Heroicons أو غيره)
5. **الأبعاد في السلة** تنتقل من modal منفصل → grid مباشر داخل بطاقة المنتج
6. **موضع السلة** ينقل من يمين → يسار الشاشة في الـ POS
7. **الـ Sidebar** ينتقل من ثابت → `w-20 hover:w-64` collapsible
