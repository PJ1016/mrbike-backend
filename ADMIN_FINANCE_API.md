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
- **Commission** is not stored per booking — it's derived as
  `booking.totalBill × dealer.commission / 100` at read time, using the dealer's
  *current* commission rate (consistent with the pre-existing `getFinanceSummary`
  / `getDealerWalletsSummary` behavior).
- **Wallet Status** (dealer wallet list/detail) reuses the canonical dealer status
  from `helper/dealerStatus.js` — there is no separate wallet-specific status field
  in the schema today.
