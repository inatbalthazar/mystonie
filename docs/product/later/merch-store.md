# F16 · Merch store & orders

> **Status: LATER (gated).** Not part of the current plan. See [later/README.md](README.md) for the gate. Written before the global, solo-sized plan: re-check against AGENTS.md before building.

**Phase:** M6 · **Priority:** Revenue

## Summary
Turn Gems into real products (keychains, T-shirts, caps, mugs). If the user doesn't have enough Gems, they can pay the difference or the full price with money.

## Rules
- Catalogue: `products` (name th/en, images, variants such as size/color, price_gems, price_thb, stock, active).
- Checkout options per order: **all Gems**, **all money**, or **Gems + money top-up for the shortfall**. The final price is calculated on the server.
- Gem spend uses the ledger ([F12](gem-wallet.md)) and is reserved at checkout. It is committed only when any money part is paid (webhook), and released on timeout/cancel.
- **Address validation** (basic, before payment): required fields (name, phone, address line, sub-district, district, province, postal code). Validate the Thai postal code ↔ province pairing using the seeded Thai address dataset, and check phone format. International shipping is out of scope for v1.
- Orders: `pending_payment → paid → packing → shipped (tracking no.) → delivered | cancelled | refunded`. Status changes are server/admin only.
- Stock is decremented in the same transaction as payment confirmation.

## Acceptance criteria
- [ ] Order with insufficient Gems offers "pay ฿X for the rest", and after the webhook both ledger and payment are recorded.
- [ ] An invalid postal code/province pairing blocks checkout with a clear message.
- [ ] A cancelled unpaid order releases reserved Gems and stock.
- [ ] Admin can mark shipped with tracking, and the user sees it in order history.

## Data
`products`, `product_variants`, `addresses`, `orders`, `order_items`, plus `payments` and `gem_ledger` from F12.
