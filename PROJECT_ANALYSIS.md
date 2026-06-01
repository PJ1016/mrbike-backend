# PROJECT_ANALYSIS.md — MrBike / BikeDoctor Backend

**Generated:** 2026-06-01
**Analyst:** Senior Software Architect
**Project:** MrBike / BikeDoctor — Bike Service Marketplace Backend

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Repository Structure](#3-repository-structure)
4. [Server Bootstrap & Configuration](#4-server-bootstrap--configuration)
5. [Route Architecture](#5-route-architecture)
6. [API Endpoints — Complete Reference](#6-api-endpoints--complete-reference)
   - 6.1 [Health Checks](#61-health-checks)
   - 6.2 [User Authentication](#62-user-authentication-bikedoctoruserauth)
   - 6.3 [Admin Authentication](#63-admin-authentication-bikedoctoradminauth)
   - 6.4 [Dealer Authentication & Registration](#64-dealer-authentication--registration-bikedoctordealerauth)
   - 6.5 [Customers](#65-customers-bikedoctorcustomers)
   - 6.6 [Dealer Management](#66-dealer-management-bikedoctordealer)
   - 6.7 [Bookings](#67-bookings-bikedoctorbookings)
   - 6.8 [Payment](#68-payment-bikedoctorpayment)
   - 6.9 [Cashfree QR](#69-cashfree-qr-bikedoctorcashfree)
   - 6.10 [Tracking](#610-tracking-bikedoctortrackings)
   - 6.11 [Notifications](#611-notifications-bikedoctornotification)
   - 6.12 [Tickets](#612-tickets-bikedoctorticket)
   - 6.13 [Services](#613-services-bikedoctorservice)
   - 6.14 [Service Features](#614-service-features-bikedoctorservicefeature)
   - 6.15 [Service Salient Features](#615-service-salient-features-bikedoctorservicesalientfeature)
   - 6.16 [Additional Services](#616-additional-services-bikedoctoradditional-service)
   - 6.17 [Base Additional Services](#617-base-additional-services-bikedoctorbase-additional-service)
   - 6.18 [Additional Options](#618-additional-options-bikedoctoradditionaloptions)
   - 6.19 [Bikes](#619-bikes-bikedoctorbike)
   - 6.20 [Locations](#620-locations-bikedoctorlocations)
   - 6.21 [Banners](#621-banners-bikedoctorbanner)
   - 6.22 [Offers](#622-offers-bikedoctoroffer)
   - 6.23 [Rewards](#623-rewards-bikedoctorreward)
   - 6.24 [Ratings](#624-ratings-bikedoctorrating)
   - 6.25 [Reports](#625-reports-bikedoctorreport)
   - 6.26 [Bank](#626-bank-bikedoctorbank)
   - 6.27 [Pickup & Drop](#627-pickup--drop-bikedoctorpickndrop)
   - 6.28 [Geocoding](#628-geocoding-bikedoctor)
   - 6.29 [State & City](#629-state--city-bikedoctorstatencity)
   - 6.30 [Token Generation](#630-token-generation-bikedoctortokengenrate)
   - 6.31 [AI — Gemini](#631-ai--gemini-aigenerate)
   - 6.32 [Chatbot (Azure OpenAI)](#632-chatbot-azure-openai-apiv2chat)
   - 6.33 [V2 Bookings](#633-v2-bookings-apiv2bookings)
   - 6.34 [V2 Banners](#634-v2-banners-apiv2banners)
   - 6.35 [Direct Service & Location Routes](#635-direct-service--location-routes)
7. [MongoDB Collections & Schemas](#7-mongodb-collections--schemas)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [External Integrations](#9-external-integrations)
10. [In-Memory Cache](#10-in-memory-cache)
11. [Error Handling](#11-error-handling)
12. [Permissions & Role System](#12-permissions--role-system)
13. [Real-Time (Socket.IO)](#13-real-time-socketio)
14. [V2 API Layer](#14-v2-api-layer)
15. [Scripts & Utilities](#15-scripts--utilities)
16. [Identified Issues & Risks](#16-identified-issues--risks)
17. [Dependency Inventory](#17-dependency-inventory)

---

## 1. Project Overview

MrBike / BikeDoctor is a bike servicing marketplace platform. Customers book bike service appointments; registered dealers (mechanics/shops) accept and fulfill those bookings. An admin panel manages dealers, bookings, payments, and sub-admins.

**Key functional areas:**
- Customer registration and OTP-based login
- Multi-step dealer onboarding with document upload and admin approval
- Service catalog management (base services, dealer-specific pricing, variants)
- Booking lifecycle: creation, OTP-verified pickup/delivery, billing, payment
- Wallet system for dealers
- Real-time support tickets with Socket.IO messaging
- AI chatbot (Azure OpenAI GPT-4o-mini) for service recommendations
- Gemini AI endpoint for general content generation
- Firebase FCM push notifications
- Cashfree payment gateway integration (with partial Razorpay dead code)
- AWS S3 for file/document storage
- Azure Form Recognizer for document OCR

**Deployed entry point:** `server.js`
**Default port:** `process.env.PORT || 8001`
**Database:** MongoDB via `process.env.DATABASE_URL`

---

## 2. Technology Stack

| Category | Technology | Version |
|---|---|---|
| Runtime | Node.js | 16.x |
| Framework | Express | 4.18.1 |
| ODM | Mongoose | 6.13.8 |
| Auth | jsonwebtoken | 9.0.2 |
| Password hashing | bcryptjs | 2.4.3 |
| Real-time | Socket.IO | 4.8.1 |
| File upload | Multer | 2.0.0 |
| S3 integration | multer-s3 + @aws-sdk/client-s3 | 3.0.1 + 3.1009.0 |
| Push notifications | firebase-admin | 12.6.0 |
| AI — Gemini | @google/generative-ai | 0.24.1 |
| AI — Azure OpenAI | openai (AzureOpenAI class) | 6.35.0 |
| OCR | @azure/ai-form-recognizer | 5.1.0 |
| Payment — Cashfree | @cashfreepayments/cashfree-js | 1.0.5 |
| Payment — Razorpay | razorpay | 2.9.4 (partially dead) |
| SMS/OTP | BulkSMS via designhost.in API | — |
| SMS (dead) | twilio | 5.6.1 (commented out) |
| Logging | morgan | 1.10.0 |
| CORS | cors | 2.8.5 |
| Auto-increment IDs | mongoose-sequence | 5.3.1 |
| QR codes | qrcode | 1.5.4 |
| Email | nodemailer | 6.6.5 |
| HTTP client | axios | 1.12.2 |
| Date handling | moment | 2.29.2 |
| Process manager (dev) | nodemon | — |
| Environment | dotenv | 10.0.0 |

**Legacy package.json name:** `"hospital"` — should be corrected to `"mrbike-backend"` or `"bikedoctor"`.

---

## 3. Repository Structure

```
/Users/gicdev3/Desktop/mr bike/mrbike-backend/
├── server.js                          # Entry point
├── package.json                       # name: "hospital" (legacy)
├── routes/
│   ├── index.js                       # Main API router (all /bikedoctor/* sub-routes)
│   ├── adminAuthRoutes.js
│   ├── additionalRouter.js
│   ├── additionalOptionsRoute.js
│   ├── bankroute.js
│   ├── bannerRoutes.js
│   ├── baseAdditionalServiceRoutes.js
│   ├── bikeRoutes.js
│   ├── bookingRoutes.js
│   ├── cashfreeQRRoutes.js
│   ├── chatbotRoutes.js
│   ├── customerRoutes.js
│   ├── dealerAuthRoutes.js
│   ├── dealerRoutes.js
│   ├── geminiRoutes.js
│   ├── locationsRoutes.js
│   ├── multerRoute.js
│   ├── notification.js
│   ├── offerRoutes.js
│   ├── payment.js
│   ├── pickupndrop.js
│   ├── policyRoutes.js
│   ├── ratingRoutes.js
│   ├── reportRoutes.js
│   ├── rewardRoutes.js
│   ├── serviceRoutes.js
│   ├── servicefeatureRoute.js
│   ├── service_Salient_feature_Route.js
│   ├── StatenCity.js
│   ├── stateAndCityRoute.js
│   ├── ticketRoutes.js
│   ├── tokenRoute.js
│   └── trackingRoute.js
├── controller/                        # 37 files — business logic
│   ├── adminAuth.js
│   ├── booking.js
│   ├── cashfreeQRController.js
│   ├── chatbotController.js
│   ├── customers.js
│   ├── dealer.js
│   ├── dealerAuth.js
│   ├── dealerController.js
│   ├── geminiController.js
│   ├── map.js
│   ├── payment.js
│   ├── userAuthController.js
│   └── ... (25 others)
├── models/                            # 38 files — Mongoose schemas
│   ├── admin_model.js
│   ├── adminService.js
│   ├── banner_model.js
│   ├── Bank.js
│   ├── bikeCompanyModel.js
│   ├── bikeModel.js
│   ├── bikeVariantModel.js
│   ├── Booking.js
│   ├── cardModel.js
│   ├── ChatHistory.js
│   ├── Contact_model.js
│   ├── customer_model.js
│   ├── Dealer.js                      # LEGACY — conflicts with dealerModel.js
│   ├── dealerModel.js                 # PRIMARY dealer model (Vendor)
│   ├── FundAccount_model.js
│   ├── Notification.js
│   ├── offer_model.js
│   ├── Payment.js
│   ├── PickupnDrop.js
│   ├── Policy.js
│   ├── rating_model.js
│   ├── reward.js
│   ├── Roles_modal.js
│   ├── service_model.js
│   ├── StateAndCity_model.js
│   ├── ticket_model.js
│   ├── Tracking.js
│   ├── userBikeModel.js
│   ├── Wallet_modal.js
│   └── ... (9 others)
├── helper/
│   ├── verifyAuth.js                  # JWT verification middleware
│   ├── otpAuth.js                     # OTP generation + BulkSMS dispatch
│   ├── pushNotification.js            # FCM notification sender
│   ├── firebase/
│   │   ├── firebaseAdmin.js           # Firebase app init
│   │   └── drbike-1bd1a-firebase-adminsdk-fiyfv-c918ee06ee.json  # SERVICE ACCOUNT (committed)
│   └── ... (validation helpers)
├── utils/
│   ├── cache.js                       # SimpleCache — in-memory, Map-based
│   ├── s3Upload.js                    # createS3Upload(folder) factory
│   ├── errorhandler.js                # ErrorHandler class
│   └── ... (ID generator, performance monitor)
├── services/
│   ├── ocrService.js                  # Azure Form Recognizer integration
│   ├── addressExtractor.js
│   ├── parserService.js
│   └── preprocessService.js
├── middlewares/
│   └── error.js                       # Global error handler (CastError, 11000, JWT errors)
├── scripts/
│   ├── createIndexes.js               # npm run create-indexes
│   └── performanceReport.js          # npm run performance-report
├── v2-api/
│   ├── controllers/
│   │   ├── bookingController.js
│   │   └── bannerController.js
│   ├── models/
│   │   ├── BookingV2.js
│   │   └── BannerV2.js
│   └── routes/
│       ├── index.js
│       ├── bookingRoutes.js
│       └── bannerRoutes.js
├── uploads/                           # Local file storage (legacy)
└── views/                             # Jade/Pug templates
```

---

## 4. Server Bootstrap & Configuration

**File:** `server.js`

### Startup Sequence

1. **Polyfill:** `global.crypto` patched for Azure SDK compatibility (line 2).
2. **Express + HTTP server** instantiated.
3. **CORS** configured:
   - Origin: all origins allowed (`callback(null, true)`)
   - Methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
   - Credentials: `true`
   - Allowed headers: `Content-Type`, `Authorization`, `token`
4. **Socket.IO** initialized with all-origins policy; room events:
   - `ticket:join` — join ticket room
   - `ticket:leave` — leave ticket room
5. `app.set("io", io)` — makes Socket.IO instance injectable in controllers via `req.app.get("io")`.
6. **Middleware stack:**
   - `morgan("dev")` — request logging
   - `bodyParser.json({ limit: "50mb" })`
   - `bodyParser.urlencoded({ limit: "50mb" })`
   - `cookieParser()`
   - `express.static("public")`
7. **Route mounting** (see Section 5).
8. **MongoDB connection** via `mongoose.connect(process.env.DATABASE_URL)`.
9. **Error handlers:** multer-specific error handler, then `errorMiddleware` from `middlewares/error.js`.

### Environment Variables Required

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MongoDB connection string |
| `PORT` | HTTP listen port (default 8001) |
| `JWT_SECRET` | JWT signing secret |
| `CASHFREE_APP_ID` | Cashfree API key |
| `CASHFREE_SECRET_KEY` | Cashfree secret |
| `CASHFREE_BASE_URL` | Cashfree endpoint URL |
| `AWS_ACCESS_KEY_ID` | AWS S3 credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 credentials |
| `AWS_REGION` | AWS S3 region |
| `S3_BUCKET_NAME` | AWS S3 bucket |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Deployment name (default: gpt-4o-mini) |
| `OPENAI_API_VERSION` | API version (default: 2024-02-15-preview) |
| `GOOGLE_AI_API_KEY` | Gemini API key |
| `AZURE_FORM_RECOGNIZER_ENDPOINT` | Form Recognizer endpoint |
| `AZURE_FORM_RECOGNIZER_KEY` | Form Recognizer key |
| `BULKSMS_API_KEY` | designhost.in SMS API key |

---

## 5. Route Architecture

```
server.js
├── GET  /                              -> health check (inline)
├── GET  /bikedoctor                    -> health check JSON (inline)
├── app.use("/bikedoctor", apiRouter)   -> routes/index.js (primary API)
├── app.use("/location", ...)           -> routes/stateAndCityRoute.js
├── app.use("/service", ...)            -> routes/serviceRoutes.js
├── app.use("/bikedoctor", ...)         -> routes/policyRoutes.js
├── app.use("/testmulter", ...)         -> routes/multerRoute.js
├── app.use("/ai", ...)                 -> routes/geminiRoutes.js
├── app.use("/api/v2", ...)             -> v2-api/routes/index.js
└── app.use("/api/v2", ...)             -> routes/chatbotRoutes.js

routes/index.js (all paths relative to /bikedoctor):
├── /tokenGenrate                       -> routes/tokenRoute.js
├── /adminauth                          -> routes/adminAuthRoutes.js
├── /customers                          -> routes/customerRoutes.js
├── /service                            -> routes/serviceRoutes.js
├── /additional-service                 -> routes/additionalRouter.js
├── /base-additional-service            -> routes/baseAdditionalServiceRoutes.js
├── /ticket                             -> routes/ticketRoutes.js
├── /servicefeature [+verifyToken]      -> routes/servicefeatureRoute.js
├── /servicesalientfeature [+verifyToken] -> routes/service_Salient_feature_Route.js
├── /bike                               -> routes/bikeRoutes.js
├── /locations [+verifyToken]           -> routes/locationsRoutes.js
├── /dealer                             -> routes/dealerRoutes.js
├── /userAuth                           -> routes/userAuthRoutes.js
├── /banner                             -> routes/bannerRoutes.js
├── /offer                              -> routes/offerRoutes.js
├── /additionalOptions [+verifyToken]   -> routes/additionalOptionsRoute.js
├── /bookings                           -> routes/bookingRoutes.js
├── /trackings [+verifyToken]           -> routes/trackingRoute.js
├── /pickndrop                          -> routes/pickupndrop.js
├── /payment                            -> routes/payment.js
├── /cashfree                           -> routes/cashfreeQRRoutes.js
├── /statencity                         -> routes/StatenCity.js
├── /notification                       -> routes/notification.js
├── /bank [+verifyToken]                -> routes/bankroute.js
├── /report [+verifyToken]              -> routes/reportRoutes.js
├── /reward                             -> routes/rewardRoutes.js
├── /rating                             -> routes/ratingRoutes.js
├── POST /geocode                       -> controller/map.geocode
├── POST /geo_place                     -> controller/map.geo_place
├── POST /verify-otp                    -> controller/adminAuth.verifyOtpAdmin
└── /dealerAuth                         -> routes/dealerAuthRoutes.js
```

---

## 6. API Endpoints — Complete Reference

### 6.1 Health Checks

| Method | Path | Handler | Auth |
|---|---|---|---|
| GET | `/` | Inline — 200 OK | None |
| GET | `/bikedoctor` | Inline — JSON health response | None |

---

### 6.2 User Authentication (`/bikedoctor/userAuth`)

**File:** `routes/userAuthRoutes.js` → `controller/userAuthController.js`

| Method | Path | Handler | Auth | Description |
|---|---|---|---|---|
| POST | `/bikedoctor/userAuth/userLogin` | `userAuthController.userLogin` | None | Submit phone number; finds or creates customer; sends 4-digit OTP via BulkSMS (`http://sms.designhost.in/api/mt/SendSMS`); stores OTP in customer document |
| POST | `/bikedoctor/userAuth/otpVerify` | `userAuthController.otpVerify` | None | Verify phone + OTP; master bypass OTP `9999` accepts for any phone; on success signs JWT `{user_id, user_type:4, type:"logged"}`; returns `{success, message, token, user}` |
| POST | `/bikedoctor/userAuth/resendOtp` | `userAuthController.resendOtp` | None | Regenerates and resends OTP to previously registered phone |

**OTP sender config:** sender `"CETYGR"`, entity `"citygarage"`.

---

### 6.3 Admin Authentication (`/bikedoctor/adminauth`)

**File:** `routes/adminAuthRoutes.js` → `controller/adminAuth.js`

| Method | Path | Handler | Auth | Description |
|---|---|---|---|---|
| POST | `/bikedoctor/adminauth/register-admin` | Inline handler | None | Creates admin; bcrypt hashes password |
| POST | `/bikedoctor/adminauth/suadminLogin` | `adminAuth.suadminLogin` | None | Email + password login; bcrypt compare; returns JWT |
| PUT | `/bikedoctor/adminauth/admin/:id` | Inline handler | None | Updates admin record |
| POST | `/bikedoctor/adminauth/subadminsignup` | `adminAuth.subadminsignup` | None | Creates sub-admin |
| POST | `/bikedoctor/adminauth/send-otp` | `adminAuth.sendOtp` | None | Sends OTP to admin phone |
| POST | `/bikedoctor/adminauth/verify-otp` | `adminAuth.verifyOtp` | None | Verifies admin OTP |
| GET | `/bikedoctor/adminauth/getalladmin` | `adminAuth.getAllAdmin` | None | Lists all admin accounts |
| POST | `/bikedoctor/adminauth/update-status/:id` | `adminAuth.updateStatus` | None | Activate/deactivate admin |
| DELETE | `/bikedoctor/adminauth/deleteadmin/:admin_id` | `adminAuth.deleteAdmin` | None | Deletes admin |
| GET | `/bikedoctor/adminauth/dashboard-counts` | `adminAuth.dashboardCounts` | None | Summary counts for dashboard |
| POST | `/bikedoctor/adminauth/Changepassword/:id` | `adminAuth.changePassword` | verifyToken | Change admin password |
| POST | `/bikedoctor/adminauth/profile` | `adminAuth.updateProfilePicture` | verifyToken + multer single `images` | Upload/update profile image |
| GET | `/bikedoctor/adminauth/profile` | `adminAuth.getProfilePicture` | verifyToken | Retrieve admin profile image |
| GET | `/bikedoctor/adminauth/singleAdmin/:id` | `adminAuth.singleadmin` | verifyToken | Get single admin details |
| POST | `/bikedoctor/adminauth/AdminPermission/:id` | `adminAuth.AdminPermission` | verifyToken | Assign role/permissions to sub-admin |
| POST | `/bikedoctor/adminauth/updatePermission/:id` | `adminAuth.updateAdminPermission` | verifyToken | Update sub-admin permissions |
| GET | `/bikedoctor/adminauth/SinglePermission/:id` | `adminAuth.getSingleRole` | verifyToken | Retrieve a sub-admin's role/permissions |
| POST | `/bikedoctor/verify-otp` | `adminAuth.verifyOtpAdmin` | None | OTP verify for admin (also mounted here from index.js) |

---

### 6.4 Dealer Authentication & Registration (`/bikedoctor/dealerAuth`)

**File:** `routes/dealerAuthRoutes.js` → `controller/dealerAuth.js`

#### Authentication

| Method | Path | Handler | Auth | Description |
|---|---|---|---|---|
| POST | `/bikedoctor/dealerAuth/signin` | `dealerAuth.usersignin` | None | Dealer sign-in with password |
| POST | `/bikedoctor/dealerAuth/sendotp` | `dealerAuth.sendOtp` | None | Send OTP to dealer phone |
| POST | `/bikedoctor/dealerAuth/verifyotp` | `dealerAuth.verifyOTP` | None | Verify OTP; issue JWT |
| POST | `/bikedoctor/dealerAuth/logout` | `dealerAuth.logout` | None | Dealer logout |
| POST | `/bikedoctor/dealerAuth/changepassword` | `dealerAuth.changePassword` | None | Change dealer password |

#### Multi-Step Registration Flow

| Method | Path | Handler | Auth | Description |
|---|---|---|---|---|
| GET | `/bikedoctor/dealerAuth/progress` | `dealerAuth.getProgress` | None | Get current registration progress |
| PUT | `/bikedoctor/dealerAuth/progress/:section` | `dealerAuth.updateProgress` | None | Update progress for a named section |
| POST | `/bikedoctor/dealerAuth/basic-info/:id` | `dealerAuth.updateBasicInfo` | None | Step 1: name, phone, email |
| POST | `/bikedoctor/dealerAuth/location-info/:id` | `dealerAuth.updateLocationInfo` | None | Step 2: address, lat/lng, city, state |
| POST | `/bikedoctor/dealerAuth/shop-details/:id` | `dealerAuth.updateShopDetails` | S3 upload | Step 3: shop name, images, business hours |
| POST | `/bikedoctor/dealerAuth/upload-documents/:id` | `dealerAuth.uploadDocuments` | S3 upload (fields: `aadharFront`, `aadharBack`, `panCard`, `shopCertificate`, `faceVerificationImage`) | Step 4: KYC documents |
| POST | `/bikedoctor/dealerAuth/bank-details/:id` | `dealerAuth.updateBankDetails` | S3 upload `passbookImage` | Step 5: bank account details |
| POST | `/bikedoctor/dealerAuth/submit-registration/:id` | `dealerAuth.submitForApproval` | None | Step 6: submit; sets `registrationStatus: "Pending"` |
| GET | `/bikedoctor/dealerAuth/registration-status` | `dealerAuth.checkApprovalStatus` | None | Dealer polls approval status |

#### Admin Review Workflow

| Method | Path | Handler | Auth | Description |
|---|---|---|---|---|
| GET | `/bikedoctor/dealerAuth/pending-registrations` | `dealerAuth.getPendingRegistrations` | None | List all pending dealer registrations |
| GET | `/bikedoctor/dealerAuth/pending-registrations/:id` | `dealerAuth.getDealerDetails` | None | Single pending dealer details |
| PUT | `/bikedoctor/dealerAuth/approve/:id` | `dealerAuth.approveDealer` | None | Approve dealer; sets status `Approved` |
| PUT | `/bikedoctor/dealerAuth/reject/:id` | `dealerAuth.rejectDealer` | None | Reject dealer; sets status `Rejected` |
| PUT | `/bikedoctor/dealerAuth/verify-document/:id` | `dealerAuth.verifyDocument` | None | Set individual document verification status: `none/pending/verified/rejected` |

---

### 6.5 Customers (`/bikedoctor/customers`)

**File:** `routes/customerRoutes.js` → `controller/customers.js`

| Method | Path | Handler | Auth | Description |
|---|---|---|---|---|
| POST | `/bikedoctor/customers/addProfile` | `customers.addProfile` | verifyToken + S3 single `images` | Create/update customer profile |
| GET | `/bikedoctor/customers/getMyBikes` | `customers.getMyBikes` | verifyToken | List bikes registered to authenticated customer |
| POST | `/bikedoctor/customers/deleteMyBike/:bike_id` | `customers.deleteMyBike` | verifyToken | Remove a bike from customer profile |
| POST | `/bikedoctor/customers/addUserBike` | `customers.addUserBike` | verifyToken | Register a new bike to customer |
| PUT | `/bikedoctor/customers/user-bike/:id` | `customers.updateUserBike` | verifyToken | Update registered bike details |
| GET | `/bikedoctor/customers/customerlist` | `customers.customerlist` | None | Admin: list all customers |
| GET | `/bikedoctor/customers/customer/:user_id` | `customers.getcustomer` | None | Get single customer by ID |
| GET | `/bikedoctor/customers/customersdata/:user_id` | `customers.getcustomersData` | None | Get customer data with associated bookings/bikes |
| DELETE | `/bikedoctor/customers/deletecustomer` | `customers.deletecustomer` | None | Delete customer record |
| PUT | `/bikedoctor/customers/editcustomer/:id` | `customers.editcustomer` | verifyToken | Edit customer profile fields |
| PUT | `/bikedoctor/customers/editimage` | `customers.changeImage` | verifyToken + S3 single `images` | Update customer profile image |

---

### 6.6 Dealer Management (`/bikedoctor/dealer`)

**File:** `routes/dealerRoutes.js` → `controller/dealer.js` + `controller/dealerController.js`

| Method | Path | Handler | Auth | Description |
|---|---|---|---|---|
| GET | `/bikedoctor/dealer/services` | `service.getDealerServices` | None | Get services offered by a dealer |
| POST | `/bikedoctor/dealer/services` | `service.saveDealerServices` | None | Save/update dealer's services |
| GET | `/bikedoctor/dealer/by-service/:baseServiceId` | `service.getDealersByService` | None | Find dealers offering a specific base service |
| POST | `/bikedoctor/dealer/process` | `dealerController.processDealer` | None | Process dealer record |
| POST | `/bikedoctor/dealer/addDealer` | Inline (routes/dealerRoutes.js) | S3 upload | Add new dealer (admin) |
| PATCH | `/bikedoctor/dealer/:id/status` | Inline | None | Toggle dealer status |
| GET | `/bikedoctor/dealer/view/:id` | Inline | None | View dealer record |
| PUT | `/bikedoctor/dealer/editDealer` | Inline | S3 upload | Edit dealer (admin) |
| GET | `/bikedoctor/dealer/dealerList` | `dealer.dealerList` | None | Paginated dealer list |
| GET | `/bikedoctor/dealer/dealerWithInRange` | `dealer.dealerWithInRange` | None | Dealers within geo-radius (v1) |
| GET | `/bikedoctor/dealer/dealerWithInRange2` | `dealer.dealerWithInRange2` | None | Dealers within geo-radius (v2) |
| GET | `/bikedoctor/dealer/dealer/:id` | `dealer.singledealer` | None | Single dealer details |
| GET | `/bikedoctor/dealer/dealerWallet/:id` | `dealer.GetwalletInfo` | None | Dealer wallet transactions by ID |
| GET | `/bikedoctor/dealer/dealerWallet` | `dealer.getWallet` | None | Dealer wallet (from token context) |
| GET | `/bikedoctor/dealer/dealersWithDocFalse` | `dealer.getAllDealersWithDocFalse` | None | Dealers where `isDoc: false` |
| GET | `/bikedoctor/dealer/dealersWithVerifyFalse` | `dealer.getAllDealersWithVerifyFalse` | None | Dealers where `isVerify: false` |
| DELETE | `/bikedoctor/dealer/deleteDealer` | `dealer.deleteDealer` | None | Delete dealer |
| POST | `/bikedoctor/dealer/update_status` | `dealer.editDealerStatus` | None | Admin update dealer status |
| POST | `/bikedoctor/dealer/processTransaction/:id` | `dealer.WalletAdd` | None | Add wallet transaction |
| POST | `/bikedoctor/dealer/AddAmout/:id` | `dealer.addAmount` | None | **NOT IN USE** — adds amount |
| POST | `/bikedoctor/dealer/prepare-transfer` | `dealer.tranfer` | None | **NOT IN USE** — prepare transfer |
| GET | `/bikedoctor/dealer/getShopDetails/:id` | `dealer.getShopDetails` | None | Get dealer shop details |
| POST | `/bikedoctor/dealer/add-shop-details` | `dealer.addDealerShopDetails` | S3 upload | Add/update shop details with images |
| POST | `/bikedoctor/dealer/add-dealer-documents` | `dealer.addDealerDocuments` | S3 upload | Add dealer KYC documents |
| GET | `/bikedoctor/dealer/pending` | `dealer.getPendingWallets` | None | List pending wallet transactions |
| PUT | `/bikedoctor/dealer/updatepending` | `dealer.updateWalletStatus` | None | Approve/reject pending wallet |
| PUT | `/bikedoctor/dealer/updateDocStatus` | `dealer.updateDealerDocStatus` | None | Update `isDoc` flag |
| PUT | `/bikedoctor/dealer/updateVerification` | `dealer.updateDealerVerfication` | None | Update `isVerify` flag |
| POST | `/bikedoctor/dealer/vendor/:dealerId/online` | `dealer.setDealerOnline` | None | Toggle dealer online status |
| GET | `/bikedoctor/dealer/vendor/active` | `dealer.getActiveDealers` | None | List currently online/active dealers |

---

### 6.7 Bookings (`/bikedoctor/bookings`)

**File:** `routes/bookingRoutes.js` → `controller/booking.js`

| Method | Path | Handler | Auth | Description |
|---|---|---|---|---|
| POST | `/bikedoctor/bookings/addbooking/:id` | `booking.addbooking` | None (JWT decoded internally) | Create booking; no middleware auth but internally decodes token |
| GET | `/bikedoctor/bookings/getallbookings` | `booking.getallbookings` | None | Admin: all bookings |
| GET | `/bikedoctor/bookings/getuserbookings/:user_id` | `booking.getuserbookings` | None | Customer: their bookings |
| GET | `/bikedoctor/bookings/getbooking/:id` | `booking.getbooking` | None | Single booking by ID |
| DELETE | `/bikedoctor/bookings/deletebooking` | `booking.deletebooking` | None | Delete booking |
| PUT | `/bikedoctor/bookings/updatebooking/:id` | `booking.updateBookings` | None | Update booking fields |
| POST | `/bikedoctor/bookings/createBooking` | `booking.createBooking` | None | Alternate booking creation endpoint |
| GET | `/bikedoctor/bookings/getBookingDetails/:id` | `booking.getBookingDetails` | None | Detailed booking with populated refs |
| POST | `/bikedoctor/bookings/updateBooking` | `booking.updateBooking` | None | Update booking (alternate) |
| POST | `/bikedoctor/bookings/updateBookingStatus/:bookingId/status` | `booking.updateBookingStatus` | None | Change booking status enum |
| POST | `/bikedoctor/bookings/sendBookingOTP` | `booking.sendBookingOTP` | None | Send OTP for pickup confirmation (email) |
| POST | `/bikedoctor/bookings/sendBookingMobile` | `booking.sendOtpToMobile` | None | Send OTP for pickup via SMS |
| POST | `/bikedoctor/bookings/verifyBookingOTP` | `booking.verifyBookingOTP` | None | Verify pickup OTP (email) |
| POST | `/bikedoctor/bookings/verifyBookingMobile` | `booking.verifyOtpForMobile` | None | Verify pickup OTP (mobile) |
| POST | `/bikedoctor/bookings/update-pickup-status` | `booking.updatePickupStatus` | None | Update pickup status field |
| POST | `/bikedoctor/bookings/addNote` | `booking.addNoteToBooking` | None | Add internal note to booking |
| GET | `/bikedoctor/bookings/getNotes/:bookingId` | `booking.getNotesFromBooking` | None | Retrieve all notes for booking |
| PUT | `/bikedoctor/bookings/updateNote` | `booking.updateNoteInBooking` | None | Edit existing note |
| POST | `/bikedoctor/bookings/deleteNote` | `booking.deleteNoteFromBooking` | None | Delete a note |
| POST | `/bikedoctor/bookings/cancelBooking/:bookingId` | `booking.cancelBooking` | None | Cancel booking; sets status `user_cancelled` or `cancelled` |

**Booking ID format:** `"MRB" + MMDD + auto-increment-sequence` (IST timezone, generated in pre-save hook in `models/Booking.js`).

---

### 6.8 Payment (`/bikedoctor/payment`)

**File:** `routes/payment.js` → `controller/payment.js`

| Method | Path | Handler | Auth | Description |
|---|---|---|---|---|
| POST | `/bikedoctor/payment/initiate` | `payment.initiatePayment` | None | Create Cashfree order; NOTE: contains hardcoded test data |
| POST | `/bikedoctor/payment/create-checkout` | `payment.createCheckoutUrl` | None | Cashfree checkout URL |
| POST | `/bikedoctor/payment/create-checkout-session` | `payment.createCheckoutSession` | None | Session-based Cashfree checkout |
| POST | `/bikedoctor/payment/link` | `payment.createPaymentLink` | None | Create Cashfree payment link |
| GET | `/bikedoctor/payment/all-payments` | `payment.getAllPayments` | None | All payment records |
| GET | `/bikedoctor/payment/single-payment-detail/:id` | `payment.getPaymentById` | None | Single payment record |
| GET | `/bikedoctor/payment/webhook` | `payment.paymentWebhook` | None | Cashfree webhook; updates Payment + Booking records |
| GET | `/bikedoctor/payment/bills/booking/:booking_id` | `payment.getBillByBookingId` | None | Get bill for a booking |
| GET | `/bikedoctor/payment/bills/all` | `payment.getAllBills` | None | All bills |
| GET | `/bikedoctor/payment/user/:user_id/bills/simple` | `payment.getUserBillsSimple` | None | Simplified bill list for customer |
| GET | `/bikedoctor/payment/user/:user_id/bills/:bill_id` | `payment.getUserBillDetails` | None | Detailed bill for customer |

**Cashfree environments:**
- Sandbox: `https://sandbox.cashfree.com/pg/orders`
- Production: `https://api.cashfree.com/pg/orders`
- Toggled via `process.env.CASHFREE_BASE_URL`

---

### 6.9 Cashfree QR (`/bikedoctor/cashfree`)

**File:** `routes/cashfreeQRRoutes.js` → `controller/cashfreeQRController.js`

Handles UPI QR code-based payment flow via Cashfree.

---

### 6.10 Tracking (`/bikedoctor/trackings`)

**File:** `routes/trackingRoute.js`
**Auth:** verifyToken on all routes.

Manages the `Tracking` model (see Section 7). Tracks booking lifecycle events: `Order Placed`, `Order Confirmed`, `Order Completed`, `Payment`, `rejected`, `cash recieved`.

---

### 6.11 Notifications (`/bikedoctor/notification`)

**File:** `routes/notification.js`

CRUD for `Notification` model. Supports marking notifications read, filtering by `receiverId`/`receiverType`.

---

### 6.12 Tickets (`/bikedoctor/ticket`)

**File:** `routes/ticketRoutes.js`

Support ticket system with real-time messaging. Socket.IO rooms keyed by ticket ID.

Ticket model supports:
- `messages[]` with sender, message text, attachments, `internal` flag, `repliedTo`, `seenBy`
- `unreadFor` map (tracks unread count per participant)
- `assignee_id` for staff assignment
- Full-text search index on `subject` + `lastMessageText`
- Auto-increment `ticketNo`; `ticketNumber` format: `MKBDTKT-XXX`

---

### 6.13 Services (`/bikedoctor/service`)

**File:** `routes/serviceRoutes.js` (also mounted at `/service` from server.js)

Manages `AdminService` collection (dealer-specific services linked to `BaseService`). Supports:
- Service creation with per-bike pricing (`bikes[{model_id, variant_id, cc, price}]`)
- Filtering by dealer, company, bike model

---

### 6.14 Service Features (`/bikedoctor/servicefeature`)

**File:** `routes/servicefeatureRoute.js`
**Auth:** verifyToken on all routes.

---

### 6.15 Service Salient Features (`/bikedoctor/servicesalientfeature`)

**File:** `routes/service_Salient_feature_Route.js`
**Auth:** verifyToken on all routes.

---

### 6.16 Additional Services (`/bikedoctor/additional-service`)

**File:** `routes/additionalRouter.js`

---

### 6.17 Base Additional Services (`/bikedoctor/base-additional-service`)

**File:** `routes/baseAdditionalServiceRoutes.js`

Master catalog for additional services (add-ons) separate from primary services.

---

### 6.18 Additional Options (`/bikedoctor/additionalOptions`)

**File:** `routes/additionalOptionsRoute.js`
**Auth:** verifyToken on all routes.

---

### 6.19 Bikes (`/bikedoctor/bike`)

**File:** `routes/bikeRoutes.js`

Manages `BikeCompany`, `BikeModel`, `BikeVariant` catalogs. Powers the bike selection UI for service booking.

---

### 6.20 Locations (`/bikedoctor/locations`)

**File:** `routes/locationsRoutes.js`
**Auth:** verifyToken on all routes.

---

### 6.21 Banners (`/bikedoctor/banner`)

**File:** `routes/bannerRoutes.js` → `models/banner_model.js`

Marketing banners for app home screen.

---

### 6.22 Offers (`/bikedoctor/offer`)

**File:** `routes/offerRoutes.js` → `models/offer_model.js`

Promotional offers.

---

### 6.23 Rewards (`/bikedoctor/reward`)

**File:** `routes/rewardRoutes.js` → `models/reward.js`

Scratch-card style rewards linked to bookings. Fields: `reward_points`, `is_scratched`.

---

### 6.24 Ratings (`/bikedoctor/rating`)

**File:** `routes/ratingRoutes.js` → `models/rating_model.js`

Post-service dealer ratings. Fields: `rating`, `comment`, `review`, `reason`, `isArchived`.

---

### 6.25 Reports (`/bikedoctor/report`)

**File:** `routes/reportRoutes.js`
**Auth:** verifyToken on all routes.

---

### 6.26 Bank (`/bikedoctor/bank`)

**File:** `routes/bankroute.js` → `models/Bank.js`
**Auth:** verifyToken on all routes.

---

### 6.27 Pickup & Drop (`/bikedoctor/pickndrop`)

**File:** `routes/pickupndrop.js` → `models/PickupnDrop.js`

Pickup-and-drop service: stores user coordinates, OTP, status (0=inactive, 1=active).

---

### 6.28 Geocoding (`/bikedoctor`)

Mounted directly in `routes/index.js`:

| Method | Path | Handler | Auth |
|---|---|---|---|
| POST | `/bikedoctor/geocode` | `controller/map.geocode` | None |
| POST | `/bikedoctor/geo_place` | `controller/map.geo_place` | None |

---

### 6.29 State & City (`/bikedoctor/statencity`)

**File:** `routes/StatenCity.js` (also `routes/stateAndCityRoute.js` at `/location`)

---

### 6.30 Token Generation (`/bikedoctor/tokenGenrate`)

**File:** `routes/tokenRoute.js`

---

### 6.31 AI — Gemini (`/ai/generate`)

**File:** `routes/geminiRoutes.js` → `controller/geminiController.js`

| Method | Path | Handler | Auth | Description |
|---|---|---|---|---|
| POST | `/ai/generate` | `geminiController.generateContent` | None | Sends prompt to Google Gemini 2.5 Flash; returns generated text |

**Model:** `"gemini-2.5-flash"`

---

### 6.32 Chatbot — Azure OpenAI (`/api/v2/chat`)

**File:** `routes/chatbotRoutes.js` → `controller/chatbotController.js`

| Method | Path | Handler | Auth | Description |
|---|---|---|---|---|
| POST | `/api/v2/chat/initialize` | `chatbotController.initializeChat` | None | Start new chat session; creates `ChatHistory` document |
| POST | `/api/v2/chat/message` | `chatbotController.sendMessage` | None | Send message; appended to session; AI responds via Azure OpenAI |
| GET | `/api/v2/chat/history/:sessionId` | `chatbotController.getChatHistory` | None | Retrieve full message history for session |
| POST | `/api/v2/chat/close/:sessionId` | `chatbotController.closeChat` | None | Mark session `status: "closed"` |
| POST | `/api/v2/chat/recommendations` | `chatbotController.getServiceRecommendations` | None | Second AI call to extract structured service recommendations |
| GET | `/api/v2/chat/sessions` | `chatbotController.getUserChatSessions` | None | List all chat sessions for a user |

**Azure OpenAI config:**
- Class: `AzureOpenAI` from `openai` package
- Deployment: `process.env.AZURE_OPENAI_DEPLOYMENT_NAME` (default: `"gpt-4o-mini"`)
- API version: `process.env.OPENAI_API_VERSION` (default: `"2024-02-15-preview"`)
- System prompt: Bike service assistant with INR pricing; fetches live services from `AdminService` collection

---

### 6.33 V2 Bookings (`/api/v2/bookings`)

**File:** `v2-api/routes/bookingRoutes.js` → `v2-api/controllers/bookingController.js`

| Method | Path | Handler | Auth | Description |
|---|---|---|---|---|
| POST | `/api/v2/bookings/` | `bookingController.createBooking` | None | V2 booking creation |
| GET | `/api/v2/bookings/user/:userId` | `bookingController.getUserBookings` | None | V2: user's bookings |
| POST | `/api/v2/bookings/verify-otp` | `bookingController.verifyOtp` | None | V2 OTP verification |
| PATCH | `/api/v2/bookings/:bookingId/status` | `bookingController.updateBookingStatus` | None | V2 status update |
| GET | `/api/v2/bookings/:bookingId` | `bookingController.getBookingDetails` | None | V2 booking detail |

**Model:** `v2-api/models/BookingV2.js`

---

### 6.34 V2 Banners (`/api/v2/banners`)

**File:** `v2-api/routes/bannerRoutes.js` → `v2-api/controllers/bannerController.js`

**Model:** `v2-api/models/BannerV2.js`

---

### 6.35 Direct Service & Location Routes

| Mount point | File | Notes |
|---|---|---|
| `/service` | `routes/serviceRoutes.js` | Duplicate mount (also `/bikedoctor/service`) |
| `/location` | `routes/stateAndCityRoute.js` | Geographic data |
| `/testmulter` | `routes/multerRoute.js` | Multer test/debug route |

---

## 7. MongoDB Collections & Schemas

### 7.1 `customers` — `models/customer_model.js`

Auto-increment `id` via `mongoose-sequence`.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | Number | Auto-increment | |
| `first_name` | String | | |
| `last_name` | String | | |
| `pincode` | String | | |
| `email` | String | | |
| `password` | String | `select: false` | |
| `phone` | String | `unique` | Primary identifier |
| `state` | String | | |
| `city` | String | | |
| `address` | String | | |
| `image` | String | | S3 URL |
| `ftoken` | String | | Firebase token |
| `device_token` | String | | FCM device token |
| `userBike` | [ObjectId] | ref: `UserBike` | |
| `otp` | Number | | Stored OTP for verification |
| `isProfile` | Boolean | | |
| `reward_points` | Number | default: 0 | |

**Virtual:** `customerId` → `"MRBDC"` + `id.toString().padStart(4, "0")`

---

### 7.2 `Vendor` — `models/dealerModel.js`

Auto-increment `id`. Primary dealer model. (**Note:** `models/Dealer.js` also exists — legacy, causes confusion.)

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | Number | Auto-increment | |
| `shopName` | String | | |
| `email` | String | unique, sparse | |
| `shopEmail` | String | unique, sparse | |
| `phone` | String | required, index | |
| `password` | String | | |
| `aadharCardNo` | String | 12-digit regex | |
| `shopContact` | String | | |
| `panCardNo` | String | PAN regex validation | |
| `shopNumber` | String | | |
| `locality` | String | | |
| `shopPincode` | String | | |
| `fullAddress` | String | | |
| `city` | String | | |
| `state` | String | | |
| `latitude` | Number | | Geo-search |
| `longitude` | Number | | Geo-search |
| `ownerName` | String | | |
| `shopImages` | [String] | | S3 URLs |
| `personalEmail` | String | | |
| `personalPhone` | String | | |
| `holiday` | Mixed | | |
| `alternatePhone` | String | | |
| `permanentAddress` | Object | `{address, state, city}` | |
| `presentAddress` | Object | `{address, state, city}` | |
| `documents` | Object | `{panCardFront, aadharFront, aadharBack, shopCertificate, faceVerificationImage}` | S3 URLs |
| `bankDetails` | Object | `{accountHolderName, ifscCode, bankName, accountNumber, passbookImage}` | |
| `commission` | Number | 0–100 | |
| `tax` | Number | 0–18 | |
| `pickupCharges` | Number | | |
| `minWalletAmount` | Number | | |
| `formProgress` | Object | `{currentStep, completedSteps, lastActiveStep}` | Registration wizard state |
| `completionTimestamps` | Mixed | | |
| `registrationStatus` | String | enum: `Draft/Pending/Approved/Rejected` | |
| `otp` | String | | |
| `otpExpiry` | Date | | |
| `loginAttempts` | Number | | Account lockout counter |
| `accountLockedUntil` | Date | | |
| `isVerify` | Boolean | | |
| `isProfile` | Boolean | | |
| `isDoc` | Boolean | | |
| `isActive` | Boolean | | |
| `status` | Object | `{adminApproved, isActive, isVerified}` | |
| `documentVerification` | Object | `{aadhar, pan, bank, face, shop, passbook}` each: `none/pending/verified/rejected` | |
| `shopOpeningDate` | Date | | |
| `businessHours` | Object | `{open, close, days}` | |
| `notifications` | Object | `{email, sms, app}` | |
| `services` | [ObjectId] | ref: `AdminService` | |
| `gender` | String | | |
| `dob` | Date | | |
| `online` | Boolean | | Real-time availability |
| `createdBy` | ObjectId | | |
| `creatorModel` | String | | |
| `creatorType` | String | | |
| `createdVia` | String | | |

**Virtual:** `dealerId` → `"MRBD"` + `id.toString().padStart(4, "0")`

**Index:** `{phone: 1, email: 1, registrationStatus: 1, creatorType: 1}`

---

### 7.3 `Booking` — `models/Booking.js`

Auto-increment `id`; custom `bookingId` auto-generated in pre-save hook.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | Number | Auto-increment | |
| `bookingId` | String | unique | Format: `"MRB" + MMDD + seq` (IST) |
| `user_id` | ObjectId | ref: `customers`, required | |
| `dealer_id` | ObjectId | ref: `Vendor`, required | |
| `services` | [ObjectId] | ref: `AdminService` | |
| `additionalServices` | [ObjectId] | ref: `additionalServices` | |
| `pickupAndDropId` | ObjectId | ref: `PicknDrop` | |
| `status` | String | enum: `pending/confirmed/completed/Payment/rejected/user_cancelled/cancelled/cash received` | |
| `userBike_id` | ObjectId | ref: `UserBike`, required | |
| `pickupStatus` | String | default: `"pending"` | |
| `serviceDate` | Date | | |
| `billGenerated` | Boolean | | |
| `lastServiceKm` | Number | | Odometer at service |
| `serviceSummary` | [{serviceName, price}] | | Bill line items |
| `pickupOtp` | Number | | OTP for pickup confirmation |
| `deliveryOtp` | Number | | OTP for delivery confirmation |
| `tax` | Number | | Applied tax amount |
| `totalBill` | Number | | |
| `billStatus` | String | enum: `pending/paid/cancelled` | |
| `additionalNotes` | [String] | | Internal notes array |
| `pickupDate` | Date | | |
| `scheduleDate` | String | | |
| `timeSlot` | String | | |
| `pickupAddress` | String | | |
| `create_date` | Date | | |

**Virtual:** `vehicleLifecycleStatus` — computed from `status`, `pickupStatus`, `billGenerated`, `billStatus`.

---

### 7.4 `Payment` — `models/Payment.js`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `cf_order_id` | Number | unique, sparse | Cashfree order ID |
| `orderId` | String | unique, sparse | |
| `booking_id` | ObjectId | ref: `Booking`, required | |
| `dealer_id` | ObjectId | ref: `Vendor`, required | |
| `user_id` | ObjectId | ref: `customers`, required | |
| `orderAmount` | Number | required | |
| `payment_type` | String | enum: `ONLINE/OFFLINE/WALLET/UPI_QR/UPI/CARD/NETBANKING` | |
| `order_currency` | String | enum: `INR/USD` | |
| `order_status` | String | enum: `PENDING/SUCCESS/FAILED/CANCELLED/EXPIRED` | |
| `order_token` | String | | |
| `payment_by` | String | `dealer/user` | |
| `payment_method` | String | `card/netbanking/upi/wallet/emi/qrcode/null` | |
| `cf_payment_id` | String | | |
| `transaction_id` | String | | |
| `utr_number` | String | | |
| `refund_amount` | Number | | |
| `refund_status` | String | enum: `NONE/PENDING/PROCESSED/FAILED` | |
| `metadata` | Mixed | | Raw Cashfree response |

**Indexes:** `cf_order_id`, `orderId`, `booking_id`, `dealer_id`, `user_id`, `order_status`, `payment_type`, `create_date: -1`

---

### 7.5 `Wallet` — `models/Wallet_modal.js`

Auto-increment `id`.

| Field | Type | Notes |
|---|---|---|
| `orderId` | String | required |
| `dealer_id` | ObjectId | ref: `dealer` |
| `Amount` | Number | |
| `Type` | String | `Credit/Debit/Pending` |
| `Note` | String | |
| `Total` | Number | Running total |
| `order_status` | String | `ACTIVE/PAID/PENDING/FAILED/EXPIRED/APPROVED/REJECTED` |

---

### 7.6 `Notification` — `models/Notification.js`

| Field | Type | Notes |
|---|---|---|
| `title` | String | |
| `body` | String | |
| `data` | Object | Arbitrary payload |
| `receiverId` | ObjectId | required |
| `receiverType` | String | `user/dealer/admin` |
| `bookingId` | ObjectId | ref: `Booking` |
| `status` | String | `pending/sent/failed` |
| `sentAt` | Date | |
| `read` | Boolean | |

---

### 7.7 `Tracking` — `models/Tracking.js`

Auto-increment `id`.

| Field | Type | Notes |
|---|---|---|
| `id` | Number | Auto-increment |
| `status` | String | `Order Placed/Order Confirmed/Order Completed/Payment/rejected/cash recieved` |
| `service_id` | ObjectId | ref: `service` (single — redundant with array below) |
| `services` | [ObjectId] | ref: `service` |
| `dealer_id` | ObjectId | ref: `dealer` |
| `dealrs_id` | String | |
| `users_id` | String | |
| `booking_id` | ObjectId | ref: `Booking` |
| `user_id` | ObjectId | ref: `customers` |

> **Issue:** Both `service_id` (single) and `services[]` (array) exist — redundant field design.

---

### 7.8 `ChatHistory` — `models/ChatHistory.js`

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | ref: `customers`, required, index |
| `messages` | [{role, content, timestamp}] | `role`: `user/assistant` |
| `status` | String | `active/closed` |
| `bikeId` | ObjectId | ref: `UserBike` |
| `dealerId` | ObjectId | ref: `Vendor` |
| `recommendedServices` | [{serviceId, serviceName, reason, estimatedCost, estimatedTime}] | |
| `closedAt` | Date | |

**Indexes:** `{userId:1, createdAt:-1}`, `{status:1, createdAt:-1}`

---

### 7.9 `service` — `models/service_model.js`

Auto-increment; auto-generated `serviceId`.

| Field | Type | Notes |
|---|---|---|
| `id` | Number | Auto-increment |
| `serviceId` | String | unique; format: `MKBDSVC-XXX` |
| `name` | String | |
| `image` | String | |
| `description` | String | |
| `bikes` | [{cc, price}] | |
| `dealer_id` | ObjectId | ref: `Vendor` |

> **CRITICAL ISSUE:** `serviceId` prefix `"MKBDSVC-"` conflicts with `AdminService` (below).

---

### 7.10 `AdminService` — `models/adminService.js`

Auto-increment; auto-generated `serviceId`.

| Field | Type | Notes |
|---|---|---|
| `id` | Number | Auto-increment |
| `serviceId` | String | unique; format: `MKBDSVC-XXX` — **SAME PREFIX as service_model.js** |
| `base_service_id` | ObjectId | ref: `BaseService`, required |
| `companies` | [ObjectId] | ref: `BikeCompany` |
| `bikes` | [{model_id, variant_id, cc, price}] | Per-variant pricing |
| `dealer_id` | ObjectId | ref: `Vendor`, required |
| `description` | String | |
| `isActive` | Boolean | default: `true` |

---

### 7.11 `admin` — `models/admin_model.js`

Auto-generated ID with role-based prefix: `MKBD` + rolePrefix + `-` + sequence.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `name` | String | required | |
| `email` | String | required, unique | |
| `role` | String | enum: `Telecaller/Manager/Admin/Subadmin/Executive` | |
| `password` | String | required, `select: false` | |
| `mobile` | String | required | |
| `image` | String | | |
| `ID` | String | unique, required | Auto-generated |
| `status` | String | enum: `active/inactive` | |

---

### 7.12 `Reward` — `models/reward.js`

| Field | Type | Notes |
|---|---|---|
| `user_id` | ObjectId | ref: `customers`, required |
| `booking_id` | ObjectId | ref: `Booking`, required |
| `reward_points` | Number | required |
| `is_scratched` | Boolean | default: `false` |
| `created_at` | Date | |

---

### 7.13 `rating` — `models/rating_model.js`

Auto-increment `id`.

| Field | Type | Notes |
|---|---|---|
| `id` | Number | Auto-increment |
| `dealer_id` | String | ref: `dealer` |
| `user_id` | String | ref: `customers` |
| `traking_id` | String | Tracking ref |
| `rating` | Number | |
| `comment` | String | |
| `review` | String | |
| `reason` | String | |
| `isArchived` | Boolean | |
| `is_skipe` | String | |

---

### 7.14 `Ticket` — `models/ticket_model.js`

Auto-increment `ticketNo`; auto-generated `ticketNumber`.

| Field | Type | Notes |
|---|---|---|
| `user_id` | ObjectId | ref: `customers`, required, index |
| `user_type` | String | `admin/dealer/user` |
| `subject` | String | required |
| `status` | String | `Open/In Progress/Closed` |
| `messages` | [{sender_id, sender_type, message, attachments[{url,name,type,size}], internal, repliedTo, seenBy, editedAt, timestamp}] | |
| `lastMessageAt` | Date | |
| `lastMessageText` | String | |
| `unreadFor` | Map<String, Number> | Per-participant unread counts |
| `assignee_id` | ObjectId | Staff assignment |
| `ticketNumber` | String | unique; format: `MKBDTKT-XXX` |
| `ticketNo` | Number | Auto-increment |

**Indexes:**
- `{status:1, lastMessageAt:-1}`
- `{user_id:1, lastMessageAt:-1}`
- `{assignee_id:1, status:1, lastMessageAt:-1}`
- Full-text on `subject` + `lastMessageText`

---

### 7.15 `PicknDrop` — `models/PickupnDrop.js`

| Field | Type | Notes |
|---|---|---|
| `dealer_id` | ObjectId | ref: `dealer` |
| `user_id` | ObjectId | ref: `customers` |
| `user_lat` | Number | Customer latitude |
| `user_lng` | Number | Customer longitude |
| `otp` | Number | |
| `status` | Number | `0=inactive, 1=active` |

---

### 7.16 `Roles` — `models/Roles_modal.js`

Sub-admin permission matrix.

| Field | Type | Notes |
|---|---|---|
| `permissions` | Object | Nested permission flags (see Section 12) |
| `subAdmin` | ObjectId | ref: `admin` |

---

### 7.17 Additional Models (brief)

| Model | File | Purpose |
|---|---|---|
| `Bank` | `models/Bank.js` | Bank detail records |
| `Policy` | `models/Policy.js` | Service policies |
| `offer` | `models/offer_model.js` | Promotional offers |
| `banner` | `models/banner_model.js` | Marketing banners |
| `StateAndCity` | `models/StateAndCity_model.js` | Geographic data |
| `Contact` | `models/Contact_model.js` | Contact form submissions |
| `FundAccount` | `models/FundAccount_model.js` | Payout fund accounts |
| `cardModel` | `models/cardModel.js` | Saved card details |
| `billSchema` | (inline/models) | Bill/invoice records |
| `BaseService` | (models) | Master service catalog |
| `BikeCompany` | `models/bikeCompanyModel.js` | Manufacturer catalog |
| `BikeModel` | `models/bikeModel.js` | Bike model catalog |
| `BikeVariant` | `models/bikeVariantModel.js` | Bike variant catalog with CC |
| `UserBike` | `models/userBikeModel.js` | Customer's registered bikes |

---

## 8. Authentication & Authorization

### 8.1 verifyToken Middleware

**File:** `helper/verifyAuth.js`

**Token source:** `req.headers.token` (non-standard; not `Authorization: Bearer`)

**Flow:**
1. Read `req.headers.token`
2. Try `jwt.verify(token, process.env.JWT_SECRET)`:
   - On success: sets `req.user_id`, `req.type`, `req.user_type`
3. On failure: fall back to Google JWT decode (no signature verification):
   - Treats decoded token as super-admin; sets `req.user_type = 1`
4. Sets `req["user_id"]`, `req["type"]`, `req["user_type"]`

> **Security Issue:** The Google JWT fallback path performs no signature verification; any JWT-shaped token that fails backend verification gets treated as super-admin. See Section 16.

### 8.2 JWT Payload Structures

| Issuer | Payload | user_type |
|---|---|---|
| User login | `{user_id, user_type: 4, type: "logged"}` | 4 |
| Admin login | (email/id based) | varies |
| Dealer OTP verify | (phone/id based) | varies |
| Google fallback | (decoded, unverified) | 1 (super-admin) |

### 8.3 Master OTP Bypass

**File:** `controller/userAuthController.js`, function `otpVerify`

OTP value `9999` bypasses real OTP check for any phone number. This is a hardcoded backdoor.

---

## 9. External Integrations

### 9.1 Firebase FCM

**Files:** `helper/firebase/firebaseAdmin.js`, `helper/pushNotification.js`

**Service account:** `helper/firebase/drbike-1bd1a-firebase-adminsdk-fiyfv-c918ee06ee.json` (committed to repo — security risk)

**`Notification()` function flow:**
1. Save notification to DB with `status: "pending"`
2. Send FCM message (Android high-priority, custom sound `"notifi"`)
3. Update DB record to `status: "sent"` or `status: "failed"`

---

### 9.2 AWS S3

**File:** `utils/s3Upload.js`

**`createS3Upload(folder)`** factory returns configured `multer` middleware.

- SDK: `@aws-sdk/client-s3` v3
- Allowed MIME types: `.jpg`, `.jpeg`, `.png`, `.pdf`, `.webp`
- File size limit: 50 MB per file
- Destination: `s3://{S3_BUCKET_NAME}/{folder}/{filename}`

**Upload points:**
- Vendor documents: `aadharFront`, `aadharBack`, `panCard`, `shopCertificate`, `faceVerificationImage`
- Profile images: `images` field
- Shop images: multiple
- Bank passbook: `passbookImage`

---

### 9.3 Cashfree Payment Gateway

**Files:** `controller/payment.js`, `controller/cashfreeQRController.js`

- `initiatePayment` — creates Cashfree order (contains hardcoded test `booking_id`, `dealer_id`, `user_id` — see Issue #7 in Section 16)
- `createCheckoutUrl` — generates hosted checkout URL
- `createCheckoutSession` — session-based checkout for mobile
- `createPaymentLink` — shareable payment link
- `paymentWebhook` — updates `Payment` collection + triggers `Booking` status update

**Webhook handler:** mounted at `GET /bikedoctor/payment/webhook` (should be POST for webhooks).

**Razorpay:** Package `razorpay@2.9.4` installed; integration is partially commented out (dead code).

---

### 9.4 Azure OpenAI (Chatbot)

**File:** `controller/chatbotController.js`

- Library: `openai` package using `AzureOpenAI` class
- Deployment: `process.env.AZURE_OPENAI_DEPLOYMENT_NAME` (default: `"gpt-4o-mini"`)
- System behavior: Bike service assistant; fetches real service catalog from `AdminService`; recommends services with INR pricing
- Two-call pattern: chat response + structured recommendation extraction
- Persistence: `ChatHistory` collection

---

### 9.5 Google Gemini AI

**File:** `controller/geminiController.js`

- Library: `@google/generative-ai`
- Model: `"gemini-2.5-flash"`
- Endpoint: `POST /ai/generate`
- Simple single-turn prompt → response

---

### 9.6 BulkSMS via designhost.in

**File:** `helper/otpAuth.js`

- `otp(phone)`: generates 4-digit OTP, calls `http://sms.designhost.in/api/mt/SendSMS`
- Sender ID: `"CETYGR"`, entity: `"citygarage"`
- `pickndropotp(phone, otp)`: separate OTP sender for P&D service
- Twilio code present but fully commented out

---

### 9.7 Azure Form Recognizer

**Files:** `services/ocrService.js`, `services/addressExtractor.js`, `services/parserService.js`, `services/preprocessService.js`

- Library: `@azure/ai-form-recognizer@5.1.0`
- Used for KYC document OCR (Aadhaar, PAN, passbook)
- Pipeline: preprocess → OCR → parse → extract address fields

---

### 9.8 Socket.IO

**File:** `server.js`

- All origins allowed
- Events:
  - `ticket:join` — joins room `ticket_{ticketId}` for real-time messaging
  - `ticket:leave` — leaves room
- `io` instance accessible in controllers: `req.app.get("io")`
- Used in: ticket controller for broadcasting new messages

---

## 10. In-Memory Cache

**File:** `utils/cache.js`

**Class:** `SimpleCache`

- Storage: `Map`
- Default TTL: 5 minutes
- Auto-cleanup interval: every 10 minutes

**Cache Keys Used:**

| Key | Cached Data |
|---|---|
| `bikesByCompany` | Bikes grouped by company |
| `servicesByDealer` | Dealer-specific services |
| `adminService` | AdminService collection |
| `bikeCompanies` | BikeCompany catalog |
| `bikeModels` | BikeModel catalog |
| `bikeVariants` | BikeVariant catalog |

> **Limitation:** In-memory only — cache lost on every server restart/crash. No Redis integration.

---

## 11. Error Handling

### Global Error Middleware

**File:** `middlewares/error.js` (uses `utils/errorhandler.js`)

| Error Condition | HTTP Status | Behavior |
|---|---|---|
| `CastError` (invalid MongoDB ObjectId) | 400 | Returns formatted error |
| Duplicate key (`code 11000`) | 400 | Returns field name and value |
| `JsonWebTokenError` | 400 | "Json Web Token is invalid" |
| `TokenExpiredError` | 400 | "Json Web Token is expired" |
| All others | Error's own statusCode | Falls through |

**Response shape:** `{success: false, message: string, stack: string}`

> **Security Issue:** `stack` trace included in response — exposes internal file paths and line numbers in production.

---

## 12. Permissions & Role System

**File:** `models/Roles_modal.js`

Sub-admin accounts have a linked `Roles` document with granular permission flags:

```
permissions: {
  Dealers:  { create, update, delete }
  Booking:  { delete }
  Admin:    { create, read, update, delete }
  Services: { update, delete }
  Bikes:    { update, delete }
  Offers:   { update, delete }
  Reports:  { update }
}
```

**Enforcement:** `checkPermission()` function in `controller/booking.js` is referenced for permission checking before destructive operations.

**Admin roles:** `Telecaller`, `Manager`, `Admin`, `Subadmin`, `Executive`

---

## 13. Real-Time (Socket.IO)

**Initialized in:** `server.js`

**Access in controllers:** `req.app.get("io")`

**Events:**

| Event | Direction | Purpose |
|---|---|---|
| `ticket:join` | Client → Server | Join room for ticket `{ticketId}` |
| `ticket:leave` | Client → Server | Leave ticket room |
| (broadcast on new message) | Server → Room | New ticket message notification |

Ticket rooms are named `ticket_{ticketId}`. All participants (user, dealer, admin) can join the same room.

---

## 14. V2 API Layer

**Base path:** `/api/v2`

**Location:** `v2-api/`

A refactored API layer co-existing with v1. Currently implements bookings and banners only.

```
v2-api/
├── routes/
│   ├── index.js
│   ├── bookingRoutes.js    -> /api/v2/bookings
│   └── bannerRoutes.js     -> /api/v2/banners
├── controllers/
│   ├── bookingController.js
│   └── bannerController.js
└── models/
    ├── BookingV2.js
    └── BannerV2.js
```

**Chatbot routes** (`/api/v2/chat`) are mounted from `routes/chatbotRoutes.js` (not inside `v2-api/`), using the same `app.use("/api/v2", ...)` mount in `server.js`.

---

## 15. Scripts & Utilities

### npm Scripts

| Script | Command | Purpose |
|---|---|---|
| `start` | `node server.js` | Production start |
| `dev` | `nodemon server.js` | Development with auto-reload |
| `create-indexes` | `node scripts/createIndexes.js` | Create MongoDB indexes |
| `performance-report` | `node scripts/performanceReport.js` | Generate DB performance report |

### `scripts/createIndexes.js`

Programmatically creates MongoDB indexes for performance. Should be run after initial deploy or schema changes.

### `scripts/performanceReport.js`

Generates a performance report — likely query execution stats, slow query analysis.

### `utils/s3Upload.js`

`createS3Upload(folder)` — factory function for Multer + S3 middleware instances.

### `utils/cache.js`

`SimpleCache` — in-memory TTL cache.

### `utils/errorhandler.js`

`ErrorHandler` class extending `Error` — used to create structured error responses.

---

## 16. Identified Issues & Risks

### Security Issues

| # | Severity | Location | Description |
|---|---|---|---|
| S1 | HIGH | `server.js` line 2 | Global `crypto` polyfill applied without proper `if(!global.crypto)` guard — may override native crypto in newer Node versions |
| S2 | CRITICAL | `controller/userAuthController.js` `otpVerify` | Master OTP `9999` bypasses real OTP for any phone number — universal backdoor |
| S3 | HIGH | `controller/booking.js` `addbooking` | JWT is decoded internally without going through `verifyToken` middleware — token not cryptographically verified |
| S4 | HIGH | `middlewares/error.js` | `err.stack` included in all error responses — exposes file paths and line numbers in production |
| S5 | HIGH | `/bikedoctor/userAuth/userLogin` and `/bikedoctor/dealerAuth/sendotp` | No rate limiting on OTP request endpoints — susceptible to OTP flooding / SMS cost attacks |
| S6 | CRITICAL | `helper/firebase/drbike-1bd1a-firebase-adminsdk-fiyfv-c918ee06ee.json` | Firebase service account JSON committed to repository — must be revoked and rotated immediately |
| S7 | HIGH | `controller/payment.js` `initiatePayment` | Hardcoded `booking_id`, `dealer_id`, `user_id` test values in production code path |
| S8 | MEDIUM | `server.js` CORS config | `callback(null, true)` allows all origins — no whitelist for production |
| S9 | HIGH | `helper/verifyAuth.js` | Google JWT fallback path does not verify signature — any malformed token that fails JWT_SECRET check is treated as super-admin |

### Dead Code

| # | Location | Description |
|---|---|---|
| D1 | `models/Dealer.js` vs `models/dealerModel.js` | Two dealer models: `Dealer.js` (legacy) and `dealerModel.js` (Vendor, active). Causes confusion in `ref` strings — some still say `"dealer"` |
| D2 | `controller/payment.js` | Razorpay integration partially commented out |
| D3 | `server.js` | Large commented-out block of old server configuration code |
| D4 | `routes/dealerRoutes.js` | `/AddAmout/:id` and `/prepare-transfer` explicitly marked "NOT IN USE" |
| D5 | `helper/otpAuth.js` | Twilio SMS code fully commented out |

### Data Model Issues

| # | Severity | Location | Description |
|---|---|---|
| DM1 | HIGH | `models/service_model.js` and `models/adminService.js` | Both use `"MKBDSVC-"` as `serviceId` prefix with separate auto-increment sequences — IDs will collide across collections |
| DM2 | LOW | `models/Tracking.js` | Both `service_id` (single ObjectId) and `services[]` (array) exist — redundant; creates ambiguity |

### Configuration Issues

| # | Location | Description |
|---|---|---|
| C1 | `package.json` | `"name": "hospital"` — stale legacy name from a different project |
| C2 | `server.js` | Webhook handler `GET /bikedoctor/payment/webhook` uses GET method — payment webhooks from Cashfree should use POST |

### Performance Issues

| # | Severity | Location | Description |
|---|---|---|
| P1 | MEDIUM | `utils/cache.js` | In-memory only cache — cleared on every restart; no Redis; problematic for multi-instance deployments |
| P2 | HIGH | `controller/payment.js` `initiatePayment` | Hardcoded test data prevents real payment processing |

---

## 17. Dependency Inventory

### Production Dependencies

| Package | Version | Purpose |
|---|---|---|
| `express` | 4.18.1 | HTTP framework |
| `mongoose` | 6.13.8 | MongoDB ODM |
| `jsonwebtoken` | 9.0.2 | JWT sign/verify |
| `bcryptjs` | 2.4.3 | Password hashing |
| `socket.io` | 4.8.1 | Real-time WebSocket |
| `@aws-sdk/client-s3` | 3.1009.0 | AWS S3 v3 SDK |
| `firebase-admin` | 12.6.0 | FCM push notifications |
| `@google/generative-ai` | 0.24.1 | Gemini AI |
| `openai` | 6.35.0 | Azure OpenAI (GPT-4o-mini) |
| `@cashfreepayments/cashfree-js` | 1.0.5 | Cashfree payment |
| `razorpay` | 2.9.4 | Razorpay (partially dead) |
| `twilio` | 5.6.1 | SMS (fully dead — commented out) |
| `multer` | 2.0.0 | Multipart file upload |
| `multer-s3` | 3.0.1 | Multer S3 storage engine |
| `@azure/ai-form-recognizer` | 5.1.0 | Document OCR |
| `mongoose-sequence` | 5.3.1 | Auto-increment IDs |
| `morgan` | 1.10.0 | HTTP request logging |
| `cors` | 2.8.5 | CORS middleware |
| `cookie-parser` | 1.4.6 | Cookie parsing |
| `body-parser` | 1.19.0 | Request body parsing |
| `dotenv` | 10.0.0 | Environment variable loading |
| `moment` | 2.29.2 | Date manipulation |
| `axios` | 1.12.2 | HTTP client (external API calls) |
| `qrcode` | 1.5.4 | QR code generation |
| `nodemailer` | 6.6.5 | Email sending |

### Node Engine Requirement

```json
"engines": { "node": "16.x" }
```

> Node 16 reached end-of-life in September 2023. Upgrade to Node 20 LTS is strongly recommended.

---

*End of PROJECT_ANALYSIS.md*
