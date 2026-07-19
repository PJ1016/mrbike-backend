# Admin Finance Module API

Backend APIs for the Admin Panel Finance module: Dealer Wallets, Transactions, and
the Finance dashboard summary. All endpoints are mounted under the app's base path
(`/bikedoctor`) and require a valid admin session.

## Security

Every endpoint below is protected by the `requireAdmin` middleware
(`middlewares/requireAdmin.js`):

- Send the admin JWT as `Authorization: Bearer <token>` (or an `token` header).
- The token is verified, then re-checked against the live `admin` collection —
  the request is rejected with `403` if the admin no longer exists or its
  `status` is not `"active"`.
- No endpoint here can be reached without a valid, active admin token.

Common error responses across all endpoints:

| Status | Body | Cause |
|---|---|---|
| 400 | `{ success: false, message: "..." }` | Invalid/unrecognized filter value or malformed id |
| 401 | `{ success: false, message: "Token not provided" \| "Authentication failed" }` | Missing/invalid JWT |
| 403 | `{ success: false, message: "Admin account not found" \| "Admin account is inactive" }` | Admin no longer valid |
| 404 | `{ success: false, message: "..." }` | Resource not found |
| 500 | `{ success: false, message: "Internal server error" }` | Unexpected server error (logged server-side) |

---

## 1. Dashboard Summary

### `GET /bikedoctor/finance/summary`

Returns the six summary cards for the Finance dashboard.

**Response 200**

```json
{
  "success": true,
  "data": {
    "totalBookingValue": 452300,
    "totalCommissionEarned": 45230,
    "totalTaxCollected": 8140,
    "totalDealerEarnings": 398930,
    "totalWalletBalance": 128450.5,
    "withdrawals": {
      "total": 42,
      "pending": { "count": 5, "amount": 21000 },
      "inProgress": { "count": 2, "amount": 9000 },
      "approved": { "count": 35, "amount": 176000 }
    },
    "activeDealers": 214,
    "totalBookings": 3190,
    "todayTransactions": { "count": 18, "totalAmount": 15230.5 },
    "thisMonthTransactions": { "count": 412, "totalAmount": 289450.75 }
  }
}
```

Card mapping for the UI: **Total Wallet Balance** → `totalWalletBalance`,
**Total Earnings** → `totalDealerEarnings`, **Total Withdrawals** →
`withdrawals.approved.amount`, **Pending Withdrawals** → `withdrawals.pending.amount`,
**Today's Transactions** → `todayTransactions`, **This Month Transactions** →
`thisMonthTransactions`.

---

## 2. Dealer Wallets

### `GET /bikedoctor/finance/wallets` — List

**Query params**

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | number | 1 | |
| `limit` | number | 20 | max 100 |
| `search` | string | — | matches dealer name, shop name, or phone |
| `status` | string | — | one of `Pending`, `Pending Documents`, `Approved`, `Active`, `Inactive`, `Blocked`, `Rejected` — filters on the dealer's canonical status, used here as "wallet status" since there's no separate wallet-status field |
| `sortBy` | string | `createdAt` | `dealerName`, `shopName`, `walletBalance`, `totalEarnings`, `totalWithdrawn`, `pendingWithdrawalAmount`, `lastTransactionDate`, `createdAt` |
| `sortOrder` | string | `desc` | `asc` \| `desc` |

**Request example**

```
GET /bikedoctor/finance/wallets?search=speed&status=Active&sortBy=walletBalance&sortOrder=desc&page=1&limit=20
Authorization: Bearer <admin_jwt>
```

**Response 200**

```json
{
  "success": true,
  "data": [
    {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "dealerId": "MRBD0042",
      "dealerName": "Ramesh Kumar",
      "shopName": "Speed Motors",
      "phone": "9876543210",
      "walletBalance": 4520.5,
      "totalEarnings": 38210.0,
      "totalWithdrawn": 12000.0,
      "pendingWithdrawalAmount": 1500.0,
      "lastTransactionDate": "2026-07-18T10:15:00.000Z",
      "walletStatus": "Active",
      "createdDate": "2025-11-02T06:31:12.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 214, "pages": 11 }
}
```

### `GET /bikedoctor/finance/wallets/:id` — Details

`:id` is the dealer's Mongo `_id`.

**Query params**: `recentLimit` (default 10, max 50), `withdrawalPage` (default 1),
`withdrawalLimit` (default 10, max 100) — paginates the withdrawal history separately
from recent transactions.

**Response 200**

```json
{
  "success": true,
  "data": {
    "dealer": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "dealerId": "MRBD0042",
      "dealerName": "Ramesh Kumar",
      "shopName": "Speed Motors",
      "phone": "9876543210",
      "email": "ramesh@speedmotors.in",
      "commissionRate": 10,
      "walletStatus": "Active",
      "createdDate": "2025-11-02T06:31:12.000Z"
    },
    "walletSummary": {
      "availableBalance": 4520.5,
      "pendingBalance": 1500.0,
      "lifetimeEarnings": 38210.0,
      "totalWithdrawals": 12000.0
    },
    "recentTransactions": [
      {
        "_id": "668...",
        "transactionId": "TXN001938",
        "amount": 810.0,
        "type": "Credit",
        "transactionType": "settlement_online",
        "status": "APPROVED",
        "note": "Online settlement | Order ₹900 | Commission 10% = ₹90 | Net credit ₹810",
        "booking": { "_id": "667...", "bookingId": "MRB071812" },
        "createdAt": "2026-07-18T10:15:00.000Z"
      }
    ],
    "withdrawalHistory": {
      "data": [
        {
          "_id": "669...",
          "transactionId": "TXN001900",
          "amount": 1500.0,
          "type": "Debit",
          "transactionType": "withdrawal",
          "status": "PENDING",
          "note": "Withdrawal request",
          "booking": null,
          "createdAt": "2026-07-17T09:00:00.000Z"
        }
      ],
      "pagination": { "page": 1, "limit": 10, "total": 6, "pages": 1 }
    }
  }
}
```

Errors: `400` if `:id` is not a valid ObjectId; `404` if no dealer matches.

> Legacy endpoints `GET /bikedoctor/dealer/payouts` and
> `GET /bikedoctor/dealer/wallets/summary` remain available unchanged for any
> existing frontend callers.

---

## 3. Transactions

Transactions are the dealer wallet ledger entries (settlements, withdrawals,
deposits, manual adjustments, reconciliations), each enriched with its booking,
dealer and customer.

### `GET /bikedoctor/finance/transactions` — List

**Query params**

| Param | Type | Notes |
|---|---|---|
| `page`, `limit` | number | default 1 / 20, max limit 100 |
| `from`, `to` | ISO date | filters on `createdAt` |
| `dealer_id` | ObjectId | |
| `booking_id` | ObjectId or booking code | accepts either the Mongo `_id` or the human code, e.g. `MRB071812` |
| `transaction_type` | string | `settlement_online`, `settlement_cash`, `withdrawal`, `deposit`, `manual`, `reconciliation`, `rollback` |
| `status` | string | `ACTIVE`, `PAID`, `PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `EXPIRED`, `APPROVED`, `REJECTED` |
| `payment_method` | string | `ONLINE`, `CASH` (the booking's payment method) |
| `search` | string | dealer name/shop/phone, customer name/phone, booking code, or wallet `orderId` |
| `sortBy` | string | `createdAt` (default) \| `amount` |
| `sortOrder` | string | `asc` \| `desc` (default) |

**Request example**

```
GET /bikedoctor/finance/transactions?transaction_type=settlement_online&status=APPROVED&from=2026-07-01&to=2026-07-19&page=1&limit=20
Authorization: Bearer <admin_jwt>
```

**Response 200**

```json
{
  "success": true,
  "data": [
    {
      "_id": "668...",
      "transactionId": "TXN001938",
      "orderId": "MRB071812",
      "dealer": { "_id": "665...", "dealerId": "MRBD0042", "name": "Speed Motors", "phone": "9876543210" },
      "booking": { "_id": "667...", "bookingId": "MRB071812" },
      "customer": { "_id": "670...", "name": "Aditya Sharma", "phone": "9123456780" },
      "amount": 810.0,
      "commission": 90.0,
      "transactionType": "settlement_online",
      "status": "APPROVED",
      "paymentMethod": "ONLINE",
      "createdAt": "2026-07-18T10:15:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 412, "pages": 21 }
}
```

### `GET /bikedoctor/finance/transactions/:id` — Details

`:id` is the wallet ledger entry's Mongo `_id`.

**Response 200**

```json
{
  "success": true,
  "data": {
    "transactionId": "TXN001938",
    "_id": "668...",
    "orderId": "MRB071812",
    "transactionType": "settlement_online",
    "status": "APPROVED",
    "note": "Online settlement | Order ₹900 | Commission 10% = ₹90 | Net credit ₹810",
    "createdAt": "2026-07-18T10:15:00.000Z",
    "updatedAt": "2026-07-18T10:15:00.000Z",

    "bookingDetails": {
      "_id": "667...",
      "bookingId": "MRB071812",
      "status": "delivered",
      "totalBill": 900,
      "tax": 0,
      "paymentMethod": "ONLINE",
      "serviceSummary": [{ "serviceName": "General Service", "price": 900 }],
      "scheduleDate": "2026-07-18",
      "pickupDate": null,
      "deliveredAt": "2026-07-18T09:50:00.000Z",
      "createdAt": "2026-07-17T14:20:00.000Z"
    },

    "dealerDetails": {
      "_id": "665...",
      "dealerId": "MRBD0042",
      "shopName": "Speed Motors",
      "ownerName": "Ramesh Kumar",
      "phone": "9876543210",
      "email": "ramesh@speedmotors.in",
      "commissionRate": 10
    },

    "customerDetails": {
      "_id": "670...",
      "name": "Aditya Sharma",
      "phone": "9123456780",
      "email": "aditya@example.com"
    },

    "amountBreakdown": {
      "orderAmount": 900,
      "platformCommission": 90.0,
      "dealerShare": 810.0,
      "taxes": 0,
      "walletAmount": 810.0,
      "preBalance": 3710.5,
      "postBalance": 4520.5
    },

    "paymentGatewayResponse": {
      "cf_payment_id": "1187234567",
      "transaction_id": "T2026071812345",
      "utr_number": "309912345678",
      "payment_method": "upi",
      "payment_type": "ONLINE",
      "order_status": "SUCCESS",
      "metadata": {}
    },

    "paymentStatus": "SUCCESS",
    "refundInformation": null,

    "timeline": [
      { "event": "Booking Created", "at": "2026-07-17T14:20:00.000Z" },
      { "event": "Transaction Recorded", "at": "2026-07-18T10:15:00.000Z" },
      { "event": "Bike Delivered", "at": "2026-07-18T09:50:00.000Z" }
    ]
  }
}
```

`paymentGatewayResponse` and `refundInformation` are `null` when the booking has
no matching `Payment` record (e.g. cash bookings) or no refund was issued.

Errors: `400` if `:id` is not a valid ObjectId; `404` if no transaction matches.

---

## Recommended indexes (not yet applied)

The queries in this module hit `Wallet` and `Booking` far more heavily than any
existing feature did, and neither collection currently has indexes that match
this module's query shapes:

- **`Wallet` has no indexes at all** beyond the implicit `_id` and the
  `mongoose-sequence` counter on `id`. Every payout/transaction list query, and
  the per-dealer wallet lookups in `getDealerWallets`/`getDealerWalletDetails`,
  filter/sort on `dealer_id`, `transaction_type`, `order_status`, and `createdAt`
  — all currently unindexed, meaning full collection scans. Recommended:
  `{ dealer_id: 1, createdAt: -1 }`, `{ transaction_type: 1, order_status: 1, createdAt: -1 }`,
  `{ booking_id: 1 }`.
- **`Booking` only has a unique index on `bookingId`.** `dealer_id`, `walletSettled`,
  `user_id`, `status`, and `createdAt` are all unindexed, and `getDealerWallets`
  runs a `dealer_id` + `walletSettled` lookup per dealer row on every page.
  Recommended: `{ dealer_id: 1, walletSettled: 1 }`, `{ createdAt: -1 }`, `{ status: 1 }`, `{ user_id: 1 }`.
- **`Vendor`'s only compound index (`phone, email, registrationStatus, creatorType`)
  doesn't help the wallet list's search-by-name or status filter.** `shopName` and
  `ownerName` have no index, and the search is a `$regex` `$or` (which can't use a
  leading-wildcard index anyway) — a text index would help; `dealerStatus` also
  has no index despite being the wallet-status filter field.
- `Payment` is already well-indexed (`cf_order_id`, `orderId`, `booking_id`,
  `dealer_id`, `user_id`, `order_status`, `payment_type`, `create_date`) — no
  changes needed there.

These weren't added in this pass since creating indexes is a DB-affecting
operation better done deliberately (e.g. via `scripts/createIndexes.js`) with
awareness of current collection size, rather than as a silent side effect of an
API change.

## Routes summary

| Method | Path | Controller |
|---|---|---|
| GET | `/bikedoctor/finance/summary` | `adminFinance.getFinanceSummary` |
| GET | `/bikedoctor/finance/wallets` | `adminFinance.getDealerWallets` |
| GET | `/bikedoctor/finance/wallets/:id` | `adminFinance.getDealerWalletDetails` |
| GET | `/bikedoctor/finance/transactions` | `adminTransactions.getTransactionsList` |
| GET | `/bikedoctor/finance/transactions/:id` | `adminTransactions.getTransactionDetails` |

All routes are registered in `routes/financeRoutes.js`, mounted at `/finance` in
`routes/index.js`, and guarded by `requireAdmin` at the router level.

## Data model notes

- **Wallet balance** lives on `Vendor.wallet` (live number); the `Wallet` collection
  (`models/Wallet_modal.js`) is an append-only ledger of credits/debits/withdrawals,
  which is what this module treats as "Transactions".
- **Commission in Transactions** (`amountBreakdown.platformCommission` /
  list `commission`) is reconstructed from the ledger entry actually written at
  settlement time (`booking.totalBill` and the Wallet entry's own `Amount`), **not**
  from the dealer's current commission rate — so it stays historically accurate
  even after an admin edits a dealer's commission % later. See the comment above
  `computeCommission()` in `controller/adminTransactions.js` for the derivation.
  `dealerDetails.commissionRate` in Transaction Details is a separate field: the
  dealer's *current* rate, shown for reference only.
- Dealer Wallets' **Total Earnings** (list/detail) and the dashboard's
  **Total Earnings** card still use the dealer's *current* commission rate
  (`booking.totalBill × dealer.commission / 100`), inherited from the pre-existing
  `getFinanceSummary` / `getDealerWalletsSummary` logic — these are aggregate,
  forward-looking figures rather than a per-transaction historical record, so the
  same "past rate changes" caveat applies to them and was intentionally left as-is
  rather than rewritten in this pass.
- **Wallet Status** (dealer wallet list/detail) reuses the canonical dealer status
  from `helper/dealerStatus.js` — there is no separate wallet-specific status field
  in the schema today.
- **Refunds, bonuses, and penalties are not implemented as distinct transaction
  types.** `Wallet.transaction_type` only supports `settlement_online`,
  `settlement_cash`, `withdrawal`, `deposit`, `manual`, `reconciliation`,
  `rollback` — there is no `refund`/`bonus`/`penalty` value, and no controller in
  the codebase ever writes one. An admin can approximate a bonus or penalty via
  the existing generic manual-adjustment endpoint (`POST /dealer/processTransaction/:id`
  → `transaction_type: "manual"`, `Type: "Credit"` or `"Debit"`, free-text `Note`),
  but it will show up as `manual` in the Transactions type filter, not as a
  separately filterable "Bonus"/"Penalty" category. `Payment.refund_amount` /
  `refund_status` exist in the schema and are surfaced in
  `refundInformation`/`paymentGatewayResponse` when populated, but the only code
  that ever sets them (`initiateRefund` in `controller/payment.js`) is commented
  out and unreachable — so in practice `refundInformation` will be `null` for
  every transaction today. Building real refund support (a dealer wallet debit +
  a `refund` transaction_type) is out of scope for this module and would need its
  own workflow.
