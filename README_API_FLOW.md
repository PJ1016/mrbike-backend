# BikeDoctor API - Complete Flow Documentation

## Table of Contents
1. [Overview](#overview)
2. [Base URL & Configuration](#base-url--configuration)
3. [Authentication Flow](#authentication-flow)
4. [Complete User Journey](#complete-user-journey)
5. [Dealer App Flow](#dealer-app-flow)
6. [API Reference](#api-reference)

---

## Overview

BikeDoctor is a bike service management platform with three main user types:
- **Users/Customers** - Book bike services
- **Dealers** - Service providers who accept bookings and collect payments
- **Admin** - Platform administrators

### Payment Flow Summary
\`\`\`
User Books Service → Dealer Accepts → Dealer Generates QR Code → User Scans & Pays → Payment Verified → Service Completed
\`\`\`

---

## Base URL & Configuration

| Environment | Base URL |
|-------------|----------|
| Production | `https://api.mrbikedoctor.com/bikedoctor` |
| Production | `https://yourdomain.com/bikedoctor` |

### Required Headers
\`\`\`
Content-Type: application/json
token: <jwt_token>  (for authenticated routes)
\`\`\`

---

## Authentication Flow

### 1. User Registration & Login

#### Step 1: Send OTP for Registration
\`\`\`http
POST /bikedoctor/user/send-otp
\`\`\`
**Request Body:**
\`\`\`json
{
  "phone": "9876543210"
}
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "message": "OTP sent successfully",
  "otp": "123456"
}
\`\`\`

#### Step 2: Verify OTP & Complete Registration
\`\`\`http
POST /bikedoctor/user/verify-otp
\`\`\`
**Request Body:**
\`\`\`json
{
  "phone": "9876543210",
  "otp": "123456",
  "name": "John Doe",
  "email": "john@example.com"
}
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "name": "John Doe",
    "phone": "9876543210",
    "email": "john@example.com"
  }
}
\`\`\`

#### Step 3: User Login (Existing User)
\`\`\`http
POST /bikedoctor/user/login
\`\`\`
**Request Body:**
\`\`\`json
{
  "phone": "9876543210"
}
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "message": "OTP sent successfully"
}
\`\`\`

#### Step 4: Verify Login OTP
\`\`\`http
POST /bikedoctor/user/verify-login-otp
\`\`\`
**Request Body:**
\`\`\`json
{
  "phone": "9876543210",
  "otp": "123456"
}
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "name": "John Doe",
    "phone": "9876543210"
  }
}
\`\`\`

---

## Complete User Journey

### Phase 1: User Setup

#### 1.1 Get User Profile
\`\`\`http
GET /bikedoctor/customer/profile
Headers: token: <jwt_token>
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "name": "John Doe",
    "phone": "9876543210",
    "email": "john@example.com",
    "profileImage": "https://example.com/image.jpg"
  }
}
\`\`\`

#### 1.2 Update User Profile
\`\`\`http
PUT /bikedoctor/customer/profile
Headers: token: <jwt_token>
\`\`\`
**Request Body:**
\`\`\`json
{
  "name": "John Doe Updated",
  "email": "john.updated@example.com",
  "profileImage": "https://example.com/new-image.jpg"
}
\`\`\`

#### 1.3 Add User's Bike
\`\`\`http
POST /bikedoctor/bike/create
Headers: token: <jwt_token>
\`\`\`
**Request Body:**
\`\`\`json
{
  "bikeName": "Honda Activa",
  "bikeModel": "6G",
  "bikeNumber": "MH01AB1234",
  "bikeType": "Scooter",
  "fuelType": "Petrol",
  "year": "2022"
}
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "message": "Bike added successfully",
  "data": {
    "_id": "64f8b2c3d4e5f6a7b8c9d0e1",
    "bikeName": "Honda Activa",
    "bikeModel": "6G",
    "bikeNumber": "MH01AB1234",
    "user_id": "64f8a1b2c3d4e5f6a7b8c9d0"
  }
}
\`\`\`

#### 1.4 Get User's Bikes
\`\`\`http
GET /bikedoctor/bike/user-bikes
Headers: token: <jwt_token>
\`\`\`

---

### Phase 2: Browse Services & Dealers

#### 2.1 Get All Services
\`\`\`http
GET /bikedoctor/service/all
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "_id": "64f8c3d4e5f6a7b8c9d0e1f2",
      "serviceName": "General Service",
      "serviceType": "Maintenance",
      "description": "Complete bike checkup and maintenance",
      "basePrice": 500,
      "image": "https://example.com/service.jpg"
    },
    {
      "_id": "64f8c3d4e5f6a7b8c9d0e1f3",
      "serviceName": "Oil Change",
      "serviceType": "Quick Service",
      "description": "Engine oil replacement",
      "basePrice": 300
    }
  ]
}
\`\`\`

#### 2.2 Get Nearby Dealers
\`\`\`http
GET /bikedoctor/dealer/nearby?latitude=19.0760&longitude=72.8777&radius=10
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "_id": "64f8d4e5f6a7b8c9d0e1f2a3",
      "shopName": "Bike Care Center",
      "ownerName": "Raj Sharma",
      "phone": "9876543211",
      "address": "123, Main Street, Mumbai",
      "rating": 4.5,
      "distance": "2.5 km",
      "services": ["General Service", "Oil Change", "Tire Replacement"]
    }
  ]
}
\`\`\`

#### 2.3 Get Dealer Details
\`\`\`http
GET /bikedoctor/dealer/details/:dealer_id
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "_id": "64f8d4e5f6a7b8c9d0e1f2a3",
    "shopName": "Bike Care Center",
    "ownerName": "Raj Sharma",
    "phone": "9876543211",
    "email": "bikecenter@example.com",
    "address": "123, Main Street, Mumbai",
    "location": {
      "type": "Point",
      "coordinates": [72.8777, 19.0760]
    },
    "rating": 4.5,
    "totalReviews": 125,
    "workingHours": {
      "open": "09:00",
      "close": "21:00"
    },
    "services": [
      {
        "service_id": "64f8c3d4e5f6a7b8c9d0e1f2",
        "serviceName": "General Service",
        "price": 500
      }
    ]
  }
}
\`\`\`

#### 2.4 Get Available Offers
\`\`\`http
GET /bikedoctor/offer/all
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "_id": "64f8e5f6a7b8c9d0e1f2a3b4",
      "offerCode": "FIRST50",
      "description": "50% off on first service",
      "discountType": "percentage",
      "discountValue": 50,
      "maxDiscount": 200,
      "minOrderValue": 300,
      "validTill": "2024-12-31"
    }
  ]
}
\`\`\`

---

### Phase 3: Create Booking

#### 3.1 Get Available Time Slots
\`\`\`http
GET /bikedoctor/booking/available-slots?dealer_id=64f8d4e5f6a7b8c9d0e1f2a3&date=2024-01-15
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "date": "2024-01-15",
    "slots": [
      { "time": "09:00", "available": true },
      { "time": "10:00", "available": true },
      { "time": "11:00", "available": false },
      { "time": "12:00", "available": true }
    ]
  }
}
\`\`\`

#### 3.2 Apply Offer/Coupon
\`\`\`http
POST /bikedoctor/offer/apply
Headers: token: <jwt_token>
\`\`\`
**Request Body:**
\`\`\`json
{
  "offerCode": "FIRST50",
  "orderValue": 500
}
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "offerCode": "FIRST50",
    "discountAmount": 200,
    "finalAmount": 300
  }
}
\`\`\`

#### 3.3 Create Booking
\`\`\`http
POST /bikedoctor/booking/create
Headers: token: <jwt_token>
\`\`\`
**Request Body:**
\`\`\`json
{
  "dealer_id": "64f8d4e5f6a7b8c9d0e1f2a3",
  "bike_id": "64f8b2c3d4e5f6a7b8c9d0e1",
  "service_id": "64f8c3d4e5f6a7b8c9d0e1f2",
  "bookingDate": "2024-01-15",
  "bookingTime": "10:00",
  "serviceType": "pickup",
  "pickupAddress": {
    "address": "456, Park Street, Mumbai",
    "landmark": "Near City Mall",
    "latitude": 19.0760,
    "longitude": 72.8777
  },
  "additionalServices": [
    {
      "service_id": "64f8c3d4e5f6a7b8c9d0e1f4",
      "serviceName": "Chain Lubrication",
      "price": 100
    }
  ],
  "offerCode": "FIRST50",
  "notes": "Please check brakes as well"
}
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "_id": "64f8f6a7b8c9d0e1f2a3b4c5",
    "bookingId": "BK20240115001",
    "user_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "dealer_id": "64f8d4e5f6a7b8c9d0e1f2a3",
    "bike_id": "64f8b2c3d4e5f6a7b8c9d0e1",
    "service_id": "64f8c3d4e5f6a7b8c9d0e1f2",
    "bookingDate": "2024-01-15",
    "bookingTime": "10:00",
    "status": "pending",
    "serviceType": "pickup",
    "pricing": {
      "basePrice": 500,
      "additionalServices": 100,
      "subtotal": 600,
      "discount": 200,
      "tax": 72,
      "totalAmount": 472
    },
    "paymentStatus": "unpaid"
  }
}
\`\`\`

#### 3.4 Get Booking Details
\`\`\`http
GET /bikedoctor/booking/details/:booking_id
Headers: token: <jwt_token>
\`\`\`

#### 3.5 Get User's All Bookings
\`\`\`http
GET /bikedoctor/booking/user-bookings
Headers: token: <jwt_token>
\`\`\`
**Query Parameters:**
- `status` - Filter by status (pending, confirmed, in_progress, completed, cancelled)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

---

### Phase 4: Track Booking & Service

#### 4.1 Get Booking Status
\`\`\`http
GET /bikedoctor/booking/status/:booking_id
Headers: token: <jwt_token>
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "booking_id": "64f8f6a7b8c9d0e1f2a3b4c5",
    "bookingId": "BK20240115001",
    "status": "in_progress",
    "statusHistory": [
      {
        "status": "pending",
        "timestamp": "2024-01-15T09:00:00Z",
        "note": "Booking created"
      },
      {
        "status": "confirmed",
        "timestamp": "2024-01-15T09:15:00Z",
        "note": "Dealer confirmed booking"
      },
      {
        "status": "pickup_assigned",
        "timestamp": "2024-01-15T09:30:00Z",
        "note": "Pickup rider assigned"
      },
      {
        "status": "in_progress",
        "timestamp": "2024-01-15T10:30:00Z",
        "note": "Service started"
      }
    ]
  }
}
\`\`\`

#### 4.2 Track Pickup/Delivery
\`\`\`http
GET /bikedoctor/tracking/:booking_id
Headers: token: <jwt_token>
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "booking_id": "64f8f6a7b8c9d0e1f2a3b4c5",
    "trackingStatus": "pickup_in_progress",
    "rider": {
      "name": "Amit Kumar",
      "phone": "9876543212",
      "currentLocation": {
        "latitude": 19.0800,
        "longitude": 72.8800
      }
    },
    "estimatedTime": "15 mins"
  }
}
\`\`\`

---

## Dealer App Flow

### Phase 5: Dealer Authentication

#### 5.1 Dealer Login
\`\`\`http
POST /bikedoctor/dealer-auth/login
\`\`\`
**Request Body:**
\`\`\`json
{
  "phone": "9876543211"
}
\`\`\`

#### 5.2 Verify Dealer OTP
\`\`\`http
POST /bikedoctor/dealer-auth/verify-otp
\`\`\`
**Request Body:**
\`\`\`json
{
  "phone": "9876543211",
  "otp": "123456"
}
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "dealer": {
    "_id": "64f8d4e5f6a7b8c9d0e1f2a3",
    "shopName": "Bike Care Center",
    "ownerName": "Raj Sharma"
  }
}
\`\`\`

---

### Phase 6: Dealer Booking Management

#### 6.1 Get Dealer's Pending Bookings
\`\`\`http
GET /bikedoctor/booking/dealer-bookings?status=pending
Headers: token: <dealer_jwt_token>
\`\`\`

#### 6.2 Accept/Confirm Booking
\`\`\`http
PUT /bikedoctor/booking/update-status/:booking_id
Headers: token: <dealer_jwt_token>
\`\`\`
**Request Body:**
\`\`\`json
{
  "status": "confirmed",
  "note": "Booking confirmed. Will start service at scheduled time."
}
\`\`\`

#### 6.3 Update Booking Status (Service Progress)
\`\`\`http
PUT /bikedoctor/booking/update-status/:booking_id
Headers: token: <dealer_jwt_token>
\`\`\`
**Request Body:**
\`\`\`json
{
  "status": "in_progress",
  "note": "Service started - General checkup in progress"
}
\`\`\`

#### 6.4 Complete Service & Update Final Amount
\`\`\`http
PUT /bikedoctor/booking/complete/:booking_id
Headers: token: <dealer_jwt_token>
\`\`\`
**Request Body:**
\`\`\`json
{
  "finalAmount": 550,
  "additionalCharges": [
    {
      "description": "Brake pad replacement",
      "amount": 150
    }
  ],
  "note": "Service completed. Additional brake pad replacement done."
}
\`\`\`

---

### Phase 7: Payment via QR Code (Cashfree UPI)

This is the main payment flow where the dealer generates a QR code and the user scans and pays.

#### 7.1 Generate UPI QR Code (Dealer App)
\`\`\`http
POST /bikedoctor/cashfree/generate-qr
Headers: token: <dealer_jwt_token>
\`\`\`
**Request Body:**
\`\`\`json
{
  "booking_id": "64f8f6a7b8c9d0e1f2a3b4c5",
  "amount": 550,
  "customer_phone": "9876543210",
  "customer_name": "John Doe",
  "customer_email": "john@example.com"
}
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "message": "QR Code generated successfully",
  "data": {
    "order_id": "BD_64f8f6a7b8c9_1705312800000",
    "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "upi_link": "upi://pay?pa=merchant@cashfree&pn=BikeDoctor&am=550&tr=BD_64f8f6a7b8c9_1705312800000&cu=INR",
    "amount": 550,
    "expires_at": "2024-01-15T11:30:00Z",
    "payment_id": "64f9a7b8c9d0e1f2a3b4c5d6"
  }
}
\`\`\`

**QR Code Display in Dealer App:**
- The `qr_code` field contains a Base64 encoded PNG image
- Display this QR code on the dealer's device screen
- User scans this QR with any UPI app (GPay, PhonePe, Paytm, etc.)

#### 7.2 Check Payment Status (Polling)
\`\`\`http
GET /bikedoctor/cashfree/status/:order_id
Headers: token: <dealer_jwt_token>
\`\`\`
**Example:**
\`\`\`http
GET /bikedoctor/cashfree/status/BD_64f8f6a7b8c9_1705312800000
\`\`\`
**Response (Payment Pending):**
\`\`\`json
{
  "success": true,
  "data": {
    "order_id": "BD_64f8f6a7b8c9_1705312800000",
    "order_status": "ACTIVE",
    "payment_status": "pending",
    "amount": 550,
    "message": "Waiting for payment"
  }
}
\`\`\`
**Response (Payment Successful):**
\`\`\`json
{
  "success": true,
  "data": {
    "order_id": "BD_64f8f6a7b8c9_1705312800000",
    "order_status": "PAID",
    "payment_status": "paid",
    "amount": 550,
    "payment_method": "upi",
    "upi_id": "user@okicici",
    "transaction_id": "CF123456789",
    "payment_time": "2024-01-15T11:05:30Z",
    "message": "Payment successful"
  }
}
\`\`\`

**Polling Strategy (Dealer App):**
\`\`\`javascript
// Poll every 3 seconds for payment status
const checkPaymentStatus = async (orderId) => {
  const interval = setInterval(async () => {
    const response = await fetch(`/bikedoctor/cashfree/status/${orderId}`, {
      headers: { 'token': dealerToken }
    });
    const data = await response.json();
    
    if (data.data.payment_status === 'paid') {
      clearInterval(interval);
      showSuccessScreen(data.data);
    } else if (data.data.payment_status === 'failed') {
      clearInterval(interval);
      showFailureScreen(data.data);
    }
  }, 3000);
  
  // Stop polling after 30 minutes (QR expiry)
  setTimeout(() => clearInterval(interval), 30 * 60 * 1000);
};
\`\`\`

#### 7.3 Webhook (Automatic - Server to Server)
\`\`\`http
POST /bikedoctor/cashfree/webhook
\`\`\`
**Cashfree sends this automatically when payment status changes:**
\`\`\`json
{
  "data": {
    "order": {
      "order_id": "BD_64f8f6a7b8c9_1705312800000",
      "order_amount": 550,
      "order_currency": "INR",
      "order_status": "PAID"
    },
    "payment": {
      "cf_payment_id": "CF123456789",
      "payment_status": "SUCCESS",
      "payment_amount": 550,
      "payment_currency": "INR",
      "payment_method": {
        "upi": {
          "upi_id": "user@okicici"
        }
      },
      "payment_time": "2024-01-15T11:05:30Z"
    }
  },
  "event_time": "2024-01-15T11:05:32Z",
  "type": "PAYMENT_SUCCESS_WEBHOOK"
}
\`\`\`
**Server Response:**
\`\`\`json
{
  "success": true,
  "message": "Webhook processed successfully"
}
\`\`\`

#### 7.4 Get Payment Details by Booking
\`\`\`http
GET /bikedoctor/cashfree/payment/booking/:booking_id
Headers: token: <jwt_token>
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "_id": "64f9a7b8c9d0e1f2a3b4c5d6",
    "booking_id": "64f8f6a7b8c9d0e1f2a3b4c5",
    "order_id": "BD_64f8f6a7b8c9_1705312800000",
    "amount": 550,
    "status": "paid",
    "paymentType": "UPI_QR",
    "transactionId": "CF123456789",
    "paymentMethod": "upi",
    "upiId": "user@okicici",
    "paidAt": "2024-01-15T11:05:30Z"
  }
}
\`\`\`

#### 7.5 Regenerate QR Code (If Expired)
\`\`\`http
POST /bikedoctor/cashfree/regenerate-qr/:order_id
Headers: token: <dealer_jwt_token>
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "message": "QR Code regenerated successfully",
  "data": {
    "order_id": "BD_64f8f6a7b8c9_1705312800001",
    "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "upi_link": "upi://pay?pa=merchant@cashfree&pn=BikeDoctor&am=550&tr=BD_64f8f6a7b8c9_1705312800001&cu=INR",
    "expires_at": "2024-01-15T12:00:00Z"
  }
}
\`\`\`

#### 7.6 Cancel Payment
\`\`\`http
POST /bikedoctor/cashfree/cancel/:order_id
Headers: token: <dealer_jwt_token>
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "message": "Payment cancelled successfully"
}
\`\`\`

#### 7.7 Get All QR Payments (Admin/Dealer)
\`\`\`http
GET /bikedoctor/cashfree/payments?status=paid&page=1&limit=10
Headers: token: <jwt_token>
\`\`\`

---

## Complete Payment Flow Diagram

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PAYMENT FLOW SEQUENCE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER APP                    DEALER APP                    SERVER            │
│     │                            │                            │              │
│     │  1. Books Service          │                            │              │
│     │ ──────────────────────────────────────────────────────> │              │
│     │                            │                            │              │
│     │                            │  2. Accepts Booking        │              │
│     │                            │ ─────────────────────────> │              │
│     │                            │                            │              │
│     │                            │  3. Completes Service      │              │
│     │                            │ ─────────────────────────> │              │
│     │                            │                            │              │
│     │                            │  4. Generate QR Code       │              │
│     │                            │ ─────────────────────────> │              │
│     │                            │                            │              │
│     │                            │  5. QR Code + UPI Link     │              │
│     │                            │ <───────────────────────── │              │
│     │                            │                            │              │
│     │  6. Shows QR on Screen     │                            │              │
│     │ <────────────────────────  │                            │              │
│     │                            │                            │              │
│     │  7. User Scans QR          │                            │              │
│     │     with UPI App           │                            │              │
│     │         │                  │                            │              │
│     │         ▼                  │                            │              │
│     │  ┌──────────────┐          │                            │              │
│     │  │  GPay/PhonePe │          │                            │              │
│     │  │  Paytm/BHIM   │ ─────────────────────────────────────>│              │
│     │  └──────────────┘          │        8. Payment to       │              │
│     │                            │           Cashfree         │              │
│     │                            │                            │              │
│     │                            │  9. Polls Status           │              │
│     │                            │ ─────────────────────────> │              │
│     │                            │                            │              │
│     │                            │                      ┌─────┴─────┐        │
│     │                            │                      │  Cashfree │        │
│     │                            │                      │  Verifies │        │
│     │                            │                      └─────┬─────┘        │
│     │                            │                            │              │
│     │                            │  10. Webhook (PAID)        │              │
│     │                            │ <───────────────────────── │              │
│     │                            │                            │              │
│     │                            │  11. Updates DB            │              │
│     │                            │      Booking: paid         │              │
│     │                            │                            │              │
│     │  12. Payment Success       │                            │              │
│     │ <────────────────────────  │                            │              │
│     │                            │                            │              │
│     │  13. Shows Receipt         │                            │              │
│     │                            │                            │              │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

---

## Post-Payment Flow

### 8.1 Get Payment Receipt
\`\`\`http
GET /bikedoctor/payment/receipt/:booking_id
Headers: token: <jwt_token>
\`\`\`
**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "receiptNumber": "RCP20240115001",
    "bookingId": "BK20240115001",
    "customerName": "John Doe",
    "customerPhone": "9876543210",
    "dealerName": "Bike Care Center",
    "dealerAddress": "123, Main Street, Mumbai",
    "bikeName": "Honda Activa 6G",
    "bikeNumber": "MH01AB1234",
    "services": [
      { "name": "General Service", "amount": 500 },
      { "name": "Brake Pad Replacement", "amount": 150 }
    ],
    "subtotal": 650,
    "discount": 200,
    "tax": 81,
    "totalAmount": 531,
    "paymentMethod": "UPI",
    "transactionId": "CF123456789",
    "paidAt": "2024-01-15T11:05:30Z"
  }
}
\`\`\`

### 8.2 Submit Rating & Review
\`\`\`http
POST /bikedoctor/rating/create
Headers: token: <jwt_token>
\`\`\`
**Request Body:**
\`\`\`json
{
  "booking_id": "64f8f6a7b8c9d0e1f2a3b4c5",
  "dealer_id": "64f8d4e5f6a7b8c9d0e1f2a3",
  "rating": 5,
  "review": "Excellent service! Very professional and timely."
}
\`\`\`

---

## Error Responses

All APIs return consistent error responses:

\`\`\`json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (in development)"
}
\`\`\`

### Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Access denied |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate entry |
| 500 | Internal Server Error |

---

## Environment Variables Required

\`\`\`env
# Server
PORT=8001
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/bikedoctor

# JWT
JWT_SECRET=your_jwt_secret_key

# Cashfree Payment Gateway
CASHFREE_ENV=sandbox
CASHFREE_APP_ID=your_app_id
CASHFREE_SECRET_KEY=your_secret_key
CASHFREE_API_VERSION=2023-08-01
CASHFREE_BASE_URL=https://api.cashfree.com/pg
CASHFREE_QR_EXPIRY_MINUTES=30
\`\`\`

---

## Testing the Payment Flow

### Step 1: Create a Test Booking
\`\`\`bash
curl -X POST https://api.mrbikedoctor.com/bikedoctor/booking/create \
  -H "Content-Type: application/json" \
  -H "token: <user_token>" \
  -d '{
    "dealer_id": "64f8d4e5f6a7b8c9d0e1f2a3",
    "bike_id": "64f8b2c3d4e5f6a7b8c9d0e1",
    "service_id": "64f8c3d4e5f6a7b8c9d0e1f2",
    "bookingDate": "2024-01-15",
    "bookingTime": "10:00"
  }'
\`\`\`

### Step 2: Generate QR Code (as Dealer)
\`\`\`bash
curl -X POST https://api.mrbikedoctor.com/bikedoctor/cashfree/generate-qr \
  -H "Content-Type: application/json" \
  -H "token: <dealer_token>" \
  -d '{
    "booking_id": "64f8f6a7b8c9d0e1f2a3b4c5",
    "amount": 500,
    "customer_phone": "9876543210",
    "customer_name": "John Doe"
  }'
\`\`\`

### Step 3: Check Payment Status
\`\`\`bash
curl -X GET https://api.mrbikedoctor.com/bikedoctor/cashfree/status/BD_64f8f6a7b8c9_1705312800000 \
  -H "token: <dealer_token>"
\`\`\`

### Cashfree Sandbox Testing
- Use Cashfree sandbox credentials for testing
- Sandbox payments can be simulated via Cashfree dashboard
- Test UPI ID for sandbox: `testsuccess@gocash`

---

## Support

For any issues or questions:
- Email: support@bikedoctor.com
- Documentation: https://docs.bikedoctor.com
- Cashfree Docs: https://docs.cashfree.com/docs/payment-gateway

---

**Version:** 1.0.0  
**Last Updated:** January 2024
