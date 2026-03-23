# POS UI Updates

This document summarizes the UI and UX changes completed in the `klik_spa` POS frontend.

## Scope

The work focused on the main POS experience:

- header and footer layout cleanup
- profile menu visibility and stacking
- search and customer controls alignment
- font and icon flash removal on refresh
- selected-product visibility in the catalog
- cart item separation and compaction
- cart row cleanup
- touch-screen button compatibility

## Completed Changes

### 1. Header and Footer Layout

- Moved the sync status out of the POS header and into the footer next to `KLiK PoS`.
- Kept the footer branding with `Beveren Software` and the sync state together.
- Raised the POS header stacking so top controls stay above the product area.

Files:

- `src/components/Footer.tsx`
- `src/components/POSHeader.tsx`

### 2. Profile Menu and Header Controls

- Kept the profile button on the same line as the product search and the `Grid` / `List` controls.
- Raised the user dropdown z-index so it opens above the products instead of behind them.
- Improved touch behavior for the profile trigger and menu items.

Files:

- `src/components/POSHeader.tsx`
- `src/components/layout/ShellUserMenu.tsx`

### 3. Search and Customer Actions

- Added spacing between the add-customer button and the customer search field.
- Preserved the layout on both desktop and mobile order summary views.
- Improved touch targets for add-customer actions and customer dropdown buttons.

Files:

- `src/components/OrderSummary.tsx`

### 4. Refresh-Time Icon and Font Flash Fix

- Removed the dependency on Material Symbols ligature rendering for visible POS icons.
- Replaced ligature-based icons with local Lucide SVG rendering so raw words like `search`, `grid_view`, and `view_list` do not flash during refresh.
- Removed duplicate webfont loading.

Files:

- `index.html`
- `src/index.css`
- `src/components/ui/AppIcon.tsx`
- `src/components/POSHeader.tsx`
- `src/components/SearchBar.tsx`
- `src/components/layout/ShellUserMenu.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/components/BottomNavigation.tsx`

### 5. Selected Product Visibility in the Catalog

- Added a clear selected state for products that are already in the cart.
- Added `In cart xN` and `Selected in cart` indicators.
- Applied the selected state to both card view and list view.

Files:

- `src/components/ProductGrid.tsx`
- `src/components/ProductCard.tsx`
- `src/components/ProductLineView.tsx`

### 6. Cart Item Separation and Compaction

- Turned cart items into visually separated cards with border, background, and shadow.
- Reduced spacing between cart rows so more items fit in the cart.
- Reduced cart row density by tightening padding, shrinking images, tightening quantity controls, and reducing price/remove footprint.

Files:

- `src/components/OrderSummary.tsx`

### 7. Cart Row Cleanup

- Removed the duplicated unit price from the cart line item content area.
- Kept a single price block on the right side of each cart row.
- Reduced the space between cart rows again after the price cleanup.

Files:

- `src/components/OrderSummary.tsx`

### 8. Touch-Screen Compatibility

- Added shared touch-target utility classes for text buttons and icon buttons.
- Improved tap behavior with touch-friendly interaction settings and active feedback.
- Applied touch support to the current POS header, search barcode button, profile menu, cart controls, action buttons, line-view add buttons, and mobile POS controls.

Files:

- `src/index.css`
- `src/components/SearchBar.tsx`
- `src/components/POSHeader.tsx`
- `src/components/layout/ShellUserMenu.tsx`
- `src/components/OrderSummary.tsx`
- `src/components/ProductLineView.tsx`
- `src/components/MobilePOSLayout.tsx`

## Validation

- Production build executed with `npm run build`.
- Browser verification was done during the UI work using Chrome DevTools on the local POS page.
- Manual checks covered header layout, dropdown layering, refresh behavior, selected product visibility, cart density, and cart row cleanup.

## Notes

- The cart was compacted for desktop while still keeping the selected items visually separated.
- Touch support was added with shared utilities so future POS buttons can use the same behavior without repeating custom styles.
