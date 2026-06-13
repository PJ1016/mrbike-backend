I now have everything I need. Here is the complete architecture analysis.

CURRENT BOOKING ARCHITECTURE ANALYSIS
MrBike / BikeDoctor Backend — Dealer Response Timer (60s)
SECTION 1 — CURRENT FLOW ANALYSIS
Complete Booking Lifecycle (as it exists today)

USER                    BACKEND                         DEALER
 │                          │                              │
 │── POST /createBooking ──▶│                              │
 │                          │ Save Booking (status=pending)│
 │                          │ Create Tracking record        │
 │                          │ Generate pickupOtp+deliveryOtp│
 │                          │──── FCM Push ───────────────▶│
 │◀── 201 booking doc ──────│                              │
 │                          │                              │
 │                          │   [NO active timer in        │
 │                          │    createBooking — only      │
 │                          │    legacy addbooking() has   │
 │                          │    a 3-min setTimeout]       │
 │                          │                              │
 │                          │◀── POST /updateBookingStatus ┤
 │                          │    status = "confirmed"       │
 │                          │    OR "rejected"              │
 │                          │                              │
 │                          │ [if confirmed]               │
 │                          │  Check wallet ≥ -500         │
 │                          │  Save status = confirmed     │
 │                          │  FCM Push to user            │
 │                          │                              │
 │                          │ [if rejected]                │
 │                          │  Save status = rejected      │
 │                          │  FCM Push to user            │
 │                          │                              │
 │── updatePickupStatus ───▶│ status = "arriving"/"arrived"│
 │◀─────────────────────────│                              │
 │                          │                              │
 │── verifyBookingOTP ─────▶│ stage = "pickup"             │
 │                          │  pickupOtp → null            │
 │                          │  pickupStatus = "pickedup"   │
 │◀─────────────────────────│                              │
 │                          │                              │
 │── verifyBookingOTP ─────▶│ stage = "delivery"           │
 │                          │  deliveryOtp → null          │
 │                          │  handleBookingCompletion()   │
 │◀─────────────────────────│                              │
 │                          │                              │
 │── updateBookingStatus ──▶│ status = "cash received"     │
 │   (dealer action)        │  billStatus = "paid"         │
 │                          │  generateBill()              │
 │                          │  settleBookingWallet(CASH)   │
 │◀─────────────────────────│                              │
Critical Discovery #1 — createBooking Has NO Timer
The active booking creation function (createBooking, line 1071) does not set any timer. Only the legacy addbooking function (line 45, likely unused by mobile apps) has a 3-minute setTimeout. The business requirement for a 60-second timer does not exist yet in the live code path.

Critical Discovery #2 — In-Memory setTimeout is Fragile
Even in addbooking, the timer uses setTimeout in Node.js memory. On any server restart or crash, all pending timers are lost — bookings remain "pending" forever.

Critical Discovery #3 — Dealer Has No FCM Token Field
models/dealerModel.js has online: Boolean but no device_token or ftoken field. The notification calls in addbooking use dealers[0].device_token which will always be undefined. The dealer push notification path is currently broken.

Critical Discovery #4 — Socket.IO Has No Booking Events
server.js Socket.IO only handles ticket:join / ticket:leave. There are no booking rooms, no booking status events, and no real-time dealer notification via socket.

SECTION 2 — IMPACT ANALYSIS
Files that must change:

File	Why
models/Booking.js	Add timerExpiresAt, dealerResponseStatus, new status "expired"
models/dealerModel.js	Add device_token / ftoken field (currently missing)
controller/booking.js	Replace in-memory setTimeout with DB-driven expiry check; wire timer into createBooking; add expiry handler function
routes/bookingRoutes.js	Expose new timer-related endpoints
server.js	Add booking socket rooms; add periodic cron check for expired bookings
helper/pushNotification.js	Ensure dealer notification path works (token field fix)
models/Tracking.js	Add "expired" to status enum
Files that may change:

File	Why
controller/dealer.js	May need endpoint to register dealer's FCM token
models/Notification.js	May need new notification type/data fields for timer events
v2-api/routes/index.js	If V2 also handles bookings, same changes apply
SECTION 3 — DATABASE CHANGES
Booking Model — New Fields Required
Field	Type	Purpose
timerExpiresAt	Date	Absolute UTC timestamp when the 60s window closes. Set at booking creation time.
dealerResponseStatus	String enum: "awaiting", "accepted", "rejected", "expired"	Tracks the dealer-specific response state separately from the booking's overall status
Booking Model — Status Enum Change
Add "expired" to the existing enum:


"pending", "confirmed", "completed", "Payment",
"rejected", "user_cancelled", "cancelled", "cash received", "expired"  ← NEW
Tracking Model — Status Enum Change
Add "expired" to the status enum in models/Tracking.js:


"Order Placed", "Order Confirmed", "Order Completed",
"Payment", "rejected", "cash recieved", "expired"  ← NEW
Dealer Model — New Field Required
Field	Type	Purpose
device_token	String	FCM push token for dealer app (currently missing entirely)
No new collection is required. Everything fits on the existing Booking document.

SECTION 4 — API CHANGES
APIs That Must Be Updated
Method	Endpoint	Change Required
POST /createBooking	routes/bookingRoutes.js	Set timerExpiresAt = now + 60s and dealerResponseStatus = "awaiting" on creation; emit socket event to dealer's room; schedule expiry check
POST /updateBookingStatus/:bookingId/status	routes/bookingRoutes.js	Guard: reject if timerExpiresAt has already passed (booking already expired); update dealerResponseStatus on accept/reject
GET /getBookingDetails/:id	routes/bookingRoutes.js	Return timerExpiresAt and dealerResponseStatus so apps can render the countdown
GET /getuserbookings/:user_id	routes/bookingRoutes.js	Include timerExpiresAt in response for pending bookings
New APIs Required
Method	Endpoint	Purpose
POST /dealer/register-token	New or in dealer routes	Allow dealer app to save its FCM device_token to the dealer record
GET /getBookingTimerStatus/:bookingId	New in booking routes	Lightweight poll endpoint returning { timerExpiresAt, dealerResponseStatus, secondsRemaining } for apps that cannot use sockets
SECTION 5 — DEALER APP IMPACT
FCM Token Registration — Dealer app must call the new POST /dealer/register-token endpoint on login/app launch to save its push token. Currently the backend has no field to store it, so push to dealer is silently failing.

Socket Room Join — Dealer app must connect to Socket.IO and emit booking:join with { dealerId } so the server can push the 60-second countdown start event and real-time status updates.

New Booking Alert with Timer — When a booking is assigned, dealer app must receive a socket event (e.g., booking:new) carrying { bookingId, timerExpiresAt } so the UI can display a 60-second countdown.

Accept / Reject within window — The existing updateBookingStatus API call must happen before timerExpiresAt. If the dealer responds after expiry, the backend should return an error (booking already expired).

Expired Booking State — Dealer app must handle the case where a booking it was showing as pending suddenly disappears or shows as "expired" — this can arrive via either a socket event (booking:expired) or a status poll.

SECTION 6 — USER APP IMPACT
Show Waiting Screen — After booking creation, user app must show a "waiting for dealer response" screen. The timerExpiresAt returned from POST /createBooking drives the countdown UI.

Socket Room Join — User app must join a booking room (e.g., booking:join with { bookingId }) to receive real-time events: booking:confirmed, booking:rejected, booking:expired.

Expired Flow — On receiving booking:expired (or polling and finding status = "expired"), the user app must:

Dismiss the waiting screen
Show "Dealer didn't respond — please choose another dealer"
Navigate back to dealer selection with the same services pre-filled
Rejected Flow — Same navigation as expired: back to dealer selection.

No Auto-Rebooking — Per business requirements, rebooking to another dealer is manual. The app just needs to return the user to the dealer selection flow.

SECTION 7 — ADMIN PANEL IMPACT
Booking List Filter — Add "expired" as a filterable status alongside existing statuses.

Timer Visibility — Booking detail view should show timerExpiresAt and dealerResponseStatus for support troubleshooting.

Expired Booking Metrics — Analytics/dashboard may want to track how many bookings expire (dealer non-response rate), as this directly impacts GMV.

Dealer Reliability Score (future consideration) — Expired bookings per dealer could feed a reliability metric.

No breaking changes to admin APIs — Admin reads bookings; adding new fields is additive and backward-compatible.

SECTION 8 — RISKS
Risk 1 — In-Memory Timer Does Not Survive Restarts (HIGH)
The existing setTimeout approach in addbooking is already unreliable. Implementing the 60-second timer the same way for createBooking would mean any PM2 restart or crash silently leaves bookings stuck in "pending" forever.

Safe approach: Store timerExpiresAt on the booking document and use a DB-polling cron job (every 10–15 seconds) to find and expire overdue bookings. This is crash-safe and restartable.

Risk 2 — Dealer FCM Token Is Missing (HIGH)
dealerModel.js has no device_token field. Push notifications to dealers are silently failing right now. Adding the field is a non-breaking schema addition, but the dealer app must also start sending its token.

Risk 3 — Status Enum Pollution (MEDIUM)
Adding "expired" to the Booking enum is backward-compatible for new documents, but any code that uses exhaustive switch/if-else on booking statuses without a default/else case could behave unexpectedly. All status-handling code must be audited.

Risk 4 — Race Condition on Accept vs Expiry (MEDIUM)
If the dealer submits "accept" at the exact moment the cron job expires the booking, both could run concurrently. The fix: use a MongoDB findOneAndUpdate with an atomic condition — only update if status === "pending" AND timerExpiresAt > now. Whoever gets the document lock first wins.

Risk 5 — Legacy addbooking Timer Conflict (LOW)
The legacy addbooking function has its own 3-minute setTimeout. If any client still calls this endpoint, there will be two different timer behaviours (3 min vs 60 s). The legacy endpoint should be explicitly deprecated or updated to the same logic.

Risk 6 — cancelBooking Allows Cancel on Expired Bookings (LOW)
cancelBooking currently only checks status !== "pending". After adding "expired", it should also block cancel on expired bookings, or map it cleanly (expired bookings are already terminal).

SECTION 9 — IMPLEMENTATION PLAN
Steps are ordered strictly by dependency — each step must be complete before the next begins.

Step 1 — Fix Dealer FCM Token (Foundation)
Add device_token field to models/dealerModel.js. Add a POST /dealer/register-token endpoint so the dealer app can store its FCM push token. Without this, no push notifications to dealer will work.

Step 2 — Update Booking Model
In models/Booking.js:

Add timerExpiresAt: Date
Add dealerResponseStatus enum: "awaiting", "accepted", "rejected", "expired" with default "awaiting"
Add "expired" to the status enum
Step 3 — Update Tracking Model
In models/Tracking.js: add "expired" to the status enum. This keeps Tracking in sync with Booking status.

Step 4 — Update createBooking Controller
In controller/booking.js, inside createBooking:

Set timerExpiresAt = new Date(Date.now() + 60000) on the new booking document
Set dealerResponseStatus = "awaiting"
After saving, emit socket event booking:new to the dealer's socket room with { bookingId, timerExpiresAt }
Send FCM push to dealer (using the now-fixed device_token)
Remove any old setTimeout logic from addbooking
Step 5 — Add Booking Socket Rooms to server.js
In server.js, extend the Socket.IO connection handler:

booking:joinDealer event — dealer app joins room dealer:{dealerId}
booking:joinUser event — user app joins room booking:{bookingId}
Server emits booking:new, booking:confirmed, booking:rejected, booking:expired to the appropriate rooms
Step 6 — Build the Expiry Cron Job
Create a new file helper/bookingExpiryJob.js (or utils/bookingExpiryJob.js):

Poll every 10 seconds using setInterval
Query: { status: "pending", dealerResponseStatus: "awaiting", timerExpiresAt: { $lte: new Date() } }
For each result, use atomic findOneAndUpdate (not two separate operations):
Set status = "expired", dealerResponseStatus = "expired"
Update corresponding Tracking record to "expired"
Send FCM push to user: "Dealer didn't respond. Please choose another dealer."
Emit socket event booking:expired to booking:{bookingId} room
Wire this setInterval into server.js startup
Step 7 — Guard updateBookingStatus Against Expired Bookings
In updateBookingStatus controller/booking.js:

Before accepting/rejecting, check: if timerExpiresAt < now OR dealerResponseStatus === "expired", return 400 "Booking response window has closed"
On status = "confirmed": set dealerResponseStatus = "accepted", emit booking:confirmed socket event to user
On status = "rejected": set dealerResponseStatus = "rejected", emit booking:rejected socket event to user
Step 8 — Add GET /getBookingTimerStatus Endpoint
For clients that prefer polling over sockets, add a lightweight endpoint that returns:


{ "timerExpiresAt": "...", "dealerResponseStatus": "awaiting", "secondsRemaining": 34 }
This is a safety net for apps that miss socket events.

Step 9 — Update cancelBooking
Add "expired" to the terminal-status guard in cancelBooking so users cannot cancel an already-expired booking.

Step 10 — Audit All Status Switch/If-Else Blocks
Search the entire codebase for all places that branch on booking status values. Add "expired" handling (or a default/else guard) to each. Key files: controller/booking.js, v2-api/, admin panel API if it has its own status logic.

Step 11 — End-to-End Test the Full Timer Flow
Test sequence (no code merge until all pass):

Create booking → confirm timerExpiresAt is 60s in future
Let 60s elapse → confirm cron changes status to "expired"
Confirm FCM push sent to user
Confirm dealer cannot accept after expiry (400 returned)
Confirm user can create new booking to a different dealer
Test race condition: dealer accepts at T=59s → booking confirmed, not expired
Test server restart mid-timer → cron picks up expired bookings on restart
Summary of New Files

File	Purpose
helper/bookingExpiryJob.js	DB-polling expiry cron, the core of the entire feature
No other new files required. All other changes are additive modifications to existing files.