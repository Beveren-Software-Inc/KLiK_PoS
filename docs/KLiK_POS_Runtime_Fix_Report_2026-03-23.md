# KLiK POS Runtime Fix Report

Date: 2026-03-23

## Scope

This report documents the work completed to fix the runtime failures affecting:

- `/klik_pos/invoice`
- `/klik_pos/closing_shift`
- the manifest/icon loading for the SPA
- the broken real-time stock update client

It reflects the parts of the implementation plan that were actually completed in code during this fix pass.

## Plan Alignment

The changes align with these existing plan items:

- `docs/KLiK_Feature_Plan.md`
  - "Real-time Sync (WebSocket)"
  - "Fallback: polling كل 5 ثوان إن لم يعمل WebSocket"
- `docs/KLiK_POSNext_Parity_Plan.md`
  - "Real-time Sync"
  - reuse of the supported Frappe realtime model instead of a custom raw WebSocket endpoint

## Problems Found

### 1. Broken WebSocket client in the SPA

The frontend was trying to connect to:

`ws://127.0.0.1:8000/api/method/klik_pos.api.websocket.stock_updates`

That endpoint does not exist in the backend, so the browser kept failing and reconnecting.

### 2. Broken manifest icon paths

The manifest pointed to:

- `/icon-192x192.png`
- `/icon-512x512.png`

But the built assets are served from:

- `/assets/klik_pos/klik_spa/icon-192x192.png`
- `/assets/klik_pos/klik_spa/icon-512x512.png`

This caused repeated 404s and manifest warnings in DevTools.

### 3. Invoice API failure

`klik_pos.api.sales_invoice.get_sales_invoices` failed even with HTTP 200 because the backend returned:

`success: false`

Root cause:

- Frappe rejected the legacy select field `count(name) as total`
- the current framework requires aggregate dict syntax such as `{"COUNT": "name", "as": "total"}`

This broke:

- Invoice History
- Closing Shift
- any other page depending on the shared invoice-loading hook

### 4. Frontend error typing weakness

The shared `useSalesInvoices` hook stored errors as strings, while consuming pages expected `Error` objects and accessed `error.message`.

## Changes Completed

### Frontend

#### Removed the dead raw WebSocket runtime path

Completed:

- removed the obsolete `websocketService.ts`
- updated the connection status UI to rely on the existing background sync service
- kept polling as the supported fallback behavior

Result:

- no more failed socket attempts to the nonexistent `/api/method/klik_pos.api.websocket.stock_updates`

#### Fixed manifest delivery

Completed:

- corrected icon paths in the manifest
- set `start_url` and `scope` to `/klik_pos/`
- added a timestamp query to the manifest link to force browsers to fetch the updated manifest instead of using stale cached content

Result:

- no more icon 404s
- no more manifest warnings in DevTools for the tested routes

#### Hardened invoice loading

Completed:

- normalized invoice hook error handling to use `Error | null`
- guarded against non-array `message.data`
- normalized `total_count` parsing

Result:

- route-level invoice screens now render data instead of crashing into the generic error state

### Backend

#### Fixed `get_sales_invoices`

Completed:

- converted `limit` and `start` to integers
- replaced the invalid aggregate field:
  - from `count(name) as total`
  - to `{"COUNT": "name", "as": "total"}`

Result:

- the API now returns `success: true`
- `/klik_pos/invoice` loads invoice data successfully
- `/klik_pos/closing_shift` can read invoice data without failing the page

## Files Changed

- `frappe-bench/apps/klik_pos/klik_pos/api/sales_invoice.py`
- `frappe-bench/apps/klik_pos/klik_spa/src/hooks/useSalesInvoices.ts`
- `frappe-bench/apps/klik_pos/klik_spa/src/components/ConnectionStatus.tsx`
- `frappe-bench/apps/klik_pos/klik_spa/public/manifest.json`
- `frappe-bench/apps/klik_pos/klik_spa/index.html`

Deleted:

- `frappe-bench/apps/klik_pos/klik_spa/src/services/websocketService.ts`

## Verification Completed

### Browser verification with Chrome DevTools MCP

Verified on:

- `http://127.0.0.1:8000/klik_pos/invoice`
- `http://127.0.0.1:8000/klik_pos/closing_shift`

Confirmed:

- no WebSocket connection errors
- no manifest/icon 404s
- invoice history renders real invoice records
- closing shift loads successfully instead of showing the error card
- manifest icon requests return `200`

### Build verification

Completed:

- `npm run build`

Result:

- SPA bundle rebuilt successfully
- built `index.html` copied into `klik_pos/www/klik_spa.html`

## Current State After Fix

### `/klik_pos/invoice`

Current result:

- page loads successfully
- invoice list renders
- counts and totals render
- action buttons are visible

### `/klik_pos/closing_shift`

Current result:

- page loads successfully
- payment summary area renders
- no runtime load failure

Note:

- the current "All Invoices (0)" state on Closing Shift is no longer a page crash
- it is now a data/filter outcome based on the current opening entry and POS profile filters

## Remaining Follow-up Items

These were not part of the blocking runtime fix, but are worth a separate pass:

- review whether `get_opening_entry_payment_summary` should be guest-safe or strictly authenticated in all SPA entry flows
- investigate whether Closing Shift should show broader invoice data when the current opening entry has no linked invoices
- clean up repeated API calls for POS/profile/user data
- address the form accessibility warnings reported by DevTools about missing `id` or `name`

## Summary

Completed outcome:

- fixed the broken realtime client behavior
- fixed SPA manifest/icon delivery
- fixed the backend invoice API failure
- fixed the shared invoice hook contract
- restored working Invoice History and Closing Shift pages
