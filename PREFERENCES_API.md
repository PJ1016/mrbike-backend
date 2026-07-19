# Preferences Module API

Backend APIs for the Admin Panel **Preferences** module: Campaigns, Promo Codes,
Rewards & Referral, Legal documents, and App Content. All endpoints are mounted
under the app's base path (`/bikedoctor`) at the `/preferences` prefix, matching
`mrbike-admin-ui`'s `src/api/preferences/prefApiClient.js` (`API_BASE_URL` +
`/preferences/...`).

## Security

Every endpoint below is protected by the existing `requireAdmin` middleware
(`middlewares/requireAdmin.js`) — no new auth mechanism was introduced.

- Send the admin JWT as a `token` header (the admin frontend's `prefApiRequest`
  sets `headers.token = localStorage.getItem("adminToken")`) — `Authorization: Bearer <token>`
  is also accepted, for parity with the rest of the API.
- The token is verified, then re-checked against the live `admin` collection —
  the request is rejected with `403` if the admin no longer exists or its
  `status` is not `"active"`.

Common error responses across all endpoints:

| Status | Body | Cause |
|---|---|---|
| 400 | `{ success: false, message: "..." }` | Invalid/missing field, bad enum value, malformed id |
| 401 | `{ success: false, message: "Token not provided" \| "Authentication failed" }` | Missing/invalid JWT |
| 403 | `{ success: false, message: "Admin account not found" \| "Admin account is inactive" }` | Admin no longer valid |
| 404 | `{ success: false, message: "..." }` | Resource not found |
| 409 | `{ success: false, message: "Promo code already exists" }` | Duplicate promo code |
| 500 | `{ success: false, message: "Internal server error" }` | Unexpected server error (logged server-side) |

**List envelope:** every list endpoint returns `{ success: true, data: [...] }`.
The admin frontend does not currently send `page`/`limit` query params (it
loads the full list and paginates/filters client-side) — omitting them returns
the full array. Passing `page`/`limit` explicitly switches the response to
`{ success: true, data: [...], pagination: { page, limit, total, pages } }`
for future/API-testing use without breaking the current frontend contract.

**Soft delete:** `DELETE` endpoints set `isDeleted: true` rather than removing
the document (per the task's soft-delete requirement); all `GET`/list queries
filter on `isDeleted: false`, so deleted records disappear from the admin UI
exactly as a hard delete would, while remaining recoverable in the database.

---

## 1. Campaigns

Model: `models/Campaign.js` · Controller: `controller/preferences/campaignController.js` ·
Routes: `routes/preferences/campaignRoutes.js`

| Method | Path | Body / Notes |
|---|---|---|
| GET | `/bikedoctor/preferences/campaigns` | query: `search`, `status`, `targetAudience`, `page`, `limit` |
| GET | `/bikedoctor/preferences/campaigns/:id` | |
| GET | `/bikedoctor/preferences/campaigns/:id/analytics` | returns `{ sent, delivered, opened, clicked, conversionRate }` |
| POST | `/bikedoctor/preferences/campaigns` | multipart: `title`, `description`, `targetAudience`, `pushNotification`, `inAppNotification`, `scheduleAt`, `status`, `image` (file, required) |
| PUT | `/bikedoctor/preferences/campaigns/:id` | multipart, same fields, `image` optional (old S3 image is deleted if replaced) |
| DELETE | `/bikedoctor/preferences/campaigns/:id` | soft delete |
| PATCH | `/bikedoctor/preferences/campaigns/:id/status` | body: `{ "status": "draft\|scheduled\|active\|paused\|completed" }` |
| POST | `/bikedoctor/preferences/campaigns/bulk-delete` | body: `{ "ids": ["..."] }` |
| POST | `/bikedoctor/preferences/campaigns/bulk-status` | body: `{ "ids": ["..."], "status": "..." }` |

`targetAudience` enum: `all`, `new_users`, `returning_customers`, `dealers`, `inactive_users`.
Image upload reuses `utils/s3Upload.js` (`createS3Upload("campaigns")`), field name `image`.

`analytics` (sent/delivered/opened/clicked/conversionRate) is stored on the
Campaign document, defaulting to zero — there is no notification-delivery
tracking system in this codebase yet to populate it automatically. Wiring it
up to real push/in-app delivery events (via `helper/pushNotification.js` /
`helper/firebase/`) is a natural follow-up once that integration exists.

---

## 2. Promo Codes

Model: `models/PromoCode.js` (+ `models/PromoCodeUsage.js` for usage tracking) ·
Controller: `controller/preferences/promoCodeController.js` ·
Routes: `routes/preferences/promoCodeRoutes.js`

| Method | Path | Body / Notes |
|---|---|---|
| GET | `/bikedoctor/preferences/promo-codes` | query: `search` (code), `isActive`, `discountType`, `page`, `limit` |
| GET | `/bikedoctor/preferences/promo-codes/generate-code` | returns `{ code }` — server-side generator (`utils/promoCodeGenerator.js`), same `MRBD######` shape the frontend already generates client-side |
| GET | `/bikedoctor/preferences/promo-codes/:id` | |
| POST | `/bikedoctor/preferences/promo-codes` | JSON: `code`, `discountType`, `discountValue`, `maxDiscount`, `minOrder`, `usageLimit`, `perUserLimit`, `validFrom`, `validTo`, `isActive` |
| PUT | `/bikedoctor/preferences/promo-codes/:id` | JSON, same fields (partial update) |
| DELETE | `/bikedoctor/preferences/promo-codes/:id` | soft delete |
| PATCH | `/bikedoctor/preferences/promo-codes/:id/status` | body: `{ "status": true }` — **boolean**, sets `isActive` |
| POST | `/bikedoctor/preferences/promo-codes/bulk-delete` | body: `{ "ids": [...] }` |
| POST | `/bikedoctor/preferences/promo-codes/bulk-status` | body: `{ "ids": [...], "status": true }` |

`discountType` enum: `percentage`, `flat`. Codes are normalized to uppercase,
no spaces, and checked for uniqueness against active (non-deleted) codes.

**Usage tracking:** `PromoCode.usedCount` is the running redemption total
shown in the admin list. `PromoCodeUsage` records individual redemptions
(`promoCode`, `user_id`, `booking_id`, `discountApplied`) and is the schema a
customer-facing checkout flow should write to (incrementing `usedCount` and
enforcing `perUserLimit`) when it adopts this PromoCode model — that flow is
outside the Admin Preferences frontend covered here, so no route calls it yet.
The existing customer-facing promo application (`controller/offer.js`'s
`applyPromoCode`, against the separate legacy `Offer`/`offer_model.js`
collection) is untouched.

---

## 3. Rewards & Referral

Model: `models/RewardRule.js` · Controller: `controller/preferences/rewardRuleController.js` ·
Routes: `routes/preferences/rewardRuleRoutes.js`

One generic CRUD surface reused for 5 rule types, discriminated by `:ruleType`
in the path (matches `rewardRuleApi.js`'s `RULE_TYPES`):

`referral-bonus`, `point-rules`, `redemption-rules`, `signup-bonus`, `cashback-rules`

| Method | Path | Body / Notes |
|---|---|---|
| GET | `/bikedoctor/preferences/reward-rules/:ruleType` | query: `search` (ruleName), `isActive`, `page`, `limit` |
| GET | `/bikedoctor/preferences/reward-rules/:ruleType/:id` | |
| POST | `/bikedoctor/preferences/reward-rules/:ruleType` | JSON, fields vary by `ruleType` (see below) |
| PUT | `/bikedoctor/preferences/reward-rules/:ruleType/:id` | JSON, partial update |
| DELETE | `/bikedoctor/preferences/reward-rules/:ruleType/:id` | soft delete |
| PATCH | `/bikedoctor/preferences/reward-rules/:ruleType/:id/status` | body: `{ "status": true }` (boolean) |
| POST | `/bikedoctor/preferences/reward-rules/:ruleType/bulk-delete` | body: `{ "ids": [...] }` |
| POST | `/bikedoctor/preferences/reward-rules/:ruleType/bulk-status` | body: `{ "ids": [...], "status": true }` |

Payload fields per `ruleType` (all also accept `ruleName: string`, `isActive: boolean`):

- **referral-bonus**: `referrerBonusPoints`, `refereeBonusPoints`, `minBookingValue`, `maxReferralsPerUser` (numbers)
- **point-rules**: `earningBasis` (`per_100_spent`\|`fixed_per_booking`), `pointsValue` (number), `applicableService` (string)
- **redemption-rules**: `minPointsToRedeem`, `pointValueInRupees`, `maxRedemptionPerOrder` (numbers)
- **signup-bonus**: `bonusPoints`, `bonusValidityDays` (numbers)
- **cashback-rules**: `minOrderValue`, `cashbackPercentage`, `maxCashback` (numbers)

Note: the "Reward Transactions" tab in the admin UI is a separate, already
working, read-only feature (`GET /bikedoctor/reward/rewards`, existing
`controller/reward.js`) — untouched by this module.

---

## 4. Legal

Model: `models/LegalDocument.js` · Controller: `controller/preferences/legalController.js` ·
Routes: `routes/preferences/legalRoutes.js`

Singleton-per-`docType` documents holding rich-text HTML content. Fixed catalog
of 8 types (matches `legalApi.js`'s `LEGAL_DOC_TYPES`):

`user-privacy-policy`, `user-terms-conditions`, `dealer-privacy-policy`,
`dealer-terms-conditions`, `refund-policy`, `cancellation-policy`,
`about-us`, `contact-us`

| Method | Path | Body / Notes |
|---|---|---|
| GET | `/bikedoctor/preferences/legal` | returns all 8 (auto-created empty/unpublished on first access) |
| GET | `/bikedoctor/preferences/legal/:docType` | auto-creates if missing |
| PUT | `/bikedoctor/preferences/legal/:docType` | JSON: `{ "content": "<html>...", "isPublished": true }` (upsert) |
| PATCH | `/bikedoctor/preferences/legal/:docType/status` | body: `{ "status": true }` — boolean, sets `isPublished` |

No create/delete endpoints, per the task's "Get / Update / Publish-Unpublish"
scope for this module — matches `legalApi.js` exactly (no `createLegal`/`deleteLegal` exported).

---

## 5. App Content

### 5a. Banners (Home / Popup / Announcement)

Model: `models/AppBanner.js` · Controller: `controller/preferences/appBannerController.js` ·
Routes: `routes/preferences/appBannerRoutes.js`

`bannerType` path param: `home`, `popup`, `announcement`.

| Method | Path | Body / Notes |
|---|---|---|
| GET | `/bikedoctor/preferences/app-banners/:bannerType` | query: `isActive`, `page`, `limit` |
| POST | `/bikedoctor/preferences/app-banners/:bannerType` | multipart: `title`, `linkUrl`, `displayOrder`, `scheduleStart`, `scheduleEnd`, `isActive`, `image` (file, required) |
| PUT | `/bikedoctor/preferences/app-banners/:bannerType/:id` | multipart, same fields, `image` optional |
| DELETE | `/bikedoctor/preferences/app-banners/:bannerType/:id` | soft delete |
| PATCH | `/bikedoctor/preferences/app-banners/:bannerType/:id/status` | body: `{ "status": true }` (boolean) |
| POST | `/bikedoctor/preferences/app-banners/:bannerType/bulk-delete` | body: `{ "ids": [...] }` |

Image upload reuses `createS3Upload("app-banners")`, field name `image`.

### 5b. FAQ

Model: `models/Faq.js` · Controller: `controller/preferences/faqController.js` ·
Routes: `routes/preferences/faqRoutes.js`

| Method | Path | Body / Notes |
|---|---|---|
| GET | `/bikedoctor/preferences/faq` | query: `search`, `category`, `isActive`, `page`, `limit` |
| POST | `/bikedoctor/preferences/faq` | JSON: `question`, `answer` (HTML), `category`, `displayOrder`, `isActive` |
| PUT | `/bikedoctor/preferences/faq/:id` | JSON, partial update |
| DELETE | `/bikedoctor/preferences/faq/:id` | soft delete |
| PATCH | `/bikedoctor/preferences/faq/:id/status` | body: `{ "status": true }` (boolean) |
| POST | `/bikedoctor/preferences/faq/bulk-delete` | body: `{ "ids": [...] }` |

### 5c. App Settings (singleton)

Model: `models/AppSettings.js` · Controller: `controller/preferences/appSettingsController.js` ·
Routes: `routes/preferences/appSettingsRoutes.js`

| Method | Path | Body / Notes |
|---|---|---|
| GET | `/bikedoctor/preferences/app-settings` | auto-creates the singleton row on first access |
| PUT | `/bikedoctor/preferences/app-settings` | JSON, any subset of the 12 fields below |

Fields: `supportEmail`, `supportPhone`, `whatsappNumber`, `supportHours`,
`facebookUrl`, `instagramUrl`, `twitterUrl`, `youtubeUrl`, `linkedinUrl`,
`websiteUrl`, `playStoreUrl`, `appStoreUrl` (all strings).

---

## Files Added / Modified

**Added — Models**
- `models/Campaign.js`
- `models/PromoCode.js`
- `models/PromoCodeUsage.js`
- `models/RewardRule.js`
- `models/LegalDocument.js`
- `models/AppBanner.js`
- `models/Faq.js`
- `models/AppSettings.js`

**Added — Utils**
- `utils/promoCodeGenerator.js`

**Added — Controllers** (`controller/preferences/`)
- `campaignController.js`, `promoCodeController.js`, `rewardRuleController.js`,
  `legalController.js`, `appBannerController.js`, `faqController.js`, `appSettingsController.js`

**Added — Routes** (`routes/preferences/`)
- `campaignRoutes.js`, `promoCodeRoutes.js`, `rewardRuleRoutes.js`,
  `legalRoutes.js`, `appBannerRoutes.js`, `faqRoutes.js`, `appSettingsRoutes.js`, `index.js`

**Modified**
- `routes/index.js` — added `const preferences = require("./preferences/index")` and
  `router.use("/preferences", preferences)`. This is a pure addition; every
  existing line is untouched, so no existing route/behavior changes.

**Not modified** (reused as-is): `middlewares/requireAdmin.js`, `utils/s3Upload.js`,
`server.js`, `models/admin_model.js`, and every pre-existing controller/route/model
(`offer.js`/`offer_model.js`, `Policy.js`, `banner.js`/`banner_model.js`, `reward.js`, etc.).

---

## Postman

See `Preferences_API_Collection.json` in the repo root (same convention as the
existing `BikeDoctor_API_Collection.json` / `ADMIN_FINANCE_API.md`). Import it,
set the `baseUrl` collection variable (e.g. `http://localhost:8001`) and the
`token` variable to a valid admin JWT (obtained via the existing
`/bikedoctor/adminauth` login endpoint), then run any request.
