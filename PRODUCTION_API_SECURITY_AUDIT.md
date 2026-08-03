# Production API Validation & Rate Limiting Audit

## Scope and API inventory

The Express application contains **390 active route declarations across 56 route files** (excluding commented-out declarations). Every externally reachable API mount is protected by the global validation and sensitive-route rate-limit boundary in `server.js`.

| Mount | API area |
| --- | --- |
| `/bikedoctor/*` | Legacy/V1 auth, customers, dealers, bookings, payments, Cashfree, tickets, referrals, preferences, finance, catalog and app content |
| `/location/*` | State/city lookup |
| `/service/*` | Legacy service APIs |
| `/testmulter/*` | Upload API |
| `/ai/*` | AI/Gemini APIs |
| `/pricing/*` | Pricing APIs |
| `/api/v1/*` | Home, services, compatibility and serviceability APIs |
| `/api/v2/*` | V2 bookings, banners and chatbot APIs |

Health checks, public legal HTML, and static assets also pass safely through the middleware but do not have structured fields to validate. Route-level authentication remains unchanged.

## Validation added

All route mounts now use Joi as the single request-boundary validation library. The middleware validates matching fields recursively in path parameters, query strings, and JSON/form bodies while allowing unrelated legacy fields through unchanged.

- MongoDB ObjectIds, including common user, dealer, booking, service, payment, ticket, bike and admin ID names
- UUID v4/v5 fields
- Email addresses
- International and ten-digit phone numbers
- Non-negative monetary amounts with at most two decimal places for string amounts
- Four-to-eight-digit OTPs
- Positive pagination values, with a maximum page size of 100
- ISO dates and timestamps
- Status, role, receiver type and gender enums
- Required inputs for customer/dealer/admin login and OTP flows, V2 OTP verification, payment creation, Cashfree QR generation, referral validation, and support ticket creation/replies

Invalid requests retain the established error contract: `{ "success": false, "message": "..." }`.

## Rate limits added

| Category | Default limit | Protected API patterns |
| --- | ---: | --- |
| Login | 10 / 15 min | Login and sign-in routes |
| OTP send | 5 / 15 min | Send, resend and regenerate OTP routes |
| OTP verify | 10 / 15 min | OTP verification and delivery verification routes |
| Password reset/change | 5 / 30 min | Reset, forgot and change-password routes |
| Payment | 60 / 15 min | Payment, Cashfree, checkout, invoice and bill routes, including webhooks |
| Referral | 30 / 15 min | Customer and admin referral routes |
| Support | 30 / 15 min | Ticket and support routes |

Limits can be changed without code edits through `RATE_LIMIT_<CATEGORY>_MAX` and `RATE_LIMIT_<CATEGORY>_WINDOW_MINUTES`. Rate-limit errors use HTTP 429 and the standard error contract.

## Error standardization

The global error middleware consistently emits `success` and `message`. Stack traces are omitted in production and retained only outside production for debugging. Existing controller success payloads and business logic were not changed.

## Files changed

- `server.js`
- `middlewares/requestValidation.js`
- `middlewares/rateLimits.js`
- `middlewares/error.js`
- `test/securityMiddleware.test.js`
- `package.json`
- `package-lock.json`
- `PRODUCTION_API_SECURITY_AUDIT.md`

## Remaining risks

- The rate-limit store is process-local. A shared Redis-backed store is required for consistent enforcement across multiple Node processes or hosts.
- IP-based limiting requires the production reverse proxy and Express `trust proxy` setting to be configured together; an incorrect setting can group users or permit IP spoofing.
- Payment webhooks are rate-limited but should additionally be allowlisted where provider IP ranges are stable. Existing webhook signature verification should be tested against each provider's current specification.
- The codebase still contains legacy controller-local validation and heterogeneous controller-generated error bodies. The global boundary standardizes newly rejected requests and uncaught errors without changing those existing response contracts.
- Multipart field validation occurs after Multer parses a route. The global boundary validates path/query inputs, while file MIME/size controls remain the responsibility of each upload middleware.
- Dependency audit reports pre-existing vulnerable transitive packages; dependency upgrades were outside this business-logic-preserving change and need a separate compatibility pass.
