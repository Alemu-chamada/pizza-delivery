# Pizza Delivery Full-Stack Application — Project Plan

> **Oasis Infobyte SIP | Web Development & Designing | Level 3, Task 1**
> Document status: **APPROVED — Implementation may begin. `project_progress.md` created.**
> Last updated: 2026-10-05 (revision 3 — CSRF clarification applied; plan approved)

> ⚠ **AI Development Workflow notice:** This plan has been reviewed and approved by the
> project owner. `project_progress.md` has been created. Implementation proceeds phase by
> phase; each phase requires verification before the next begins. No application code is
> written ahead of the current active phase.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Project Goals and Scope](#2-project-goals-and-scope)
3. [MVP Definition](#3-mvp-definition)
4. [Functional Requirements](#4-functional-requirements)
5. [User Roles and Permissions](#5-user-roles-and-permissions)
6. [User Flows](#6-user-flows)
7. [Technical Architecture](#7-technical-architecture)
8. [Technology Stack](#8-technology-stack)
9. [Database Design and Mongoose Models](#9-database-design-and-mongoose-models)
10. [API Structure and Endpoint Responsibilities](#10-api-structure-and-endpoint-responsibilities)
11. [Frontend and Backend Folder Structure](#11-frontend-and-backend-folder-structure)
12. [UI/UX and Responsive Design Principles](#12-uiux-and-responsive-design-principles)
13. [Security Requirements](#13-security-requirements)
14. [Coding Standards and Maintainability](#14-coding-standards-and-maintainability)
15. [Error Handling, Validation, and Logging](#15-error-handling-validation-and-logging)
16. [Testing Strategy and Acceptance Criteria](#16-testing-strategy-and-acceptance-criteria)
17. [Environment Variables and External Service Configuration](#17-environment-variables-and-external-service-configuration)
18. [Constraints and Assumptions](#18-constraints-and-assumptions)
19. [Implementation Phases and Task Dependencies](#19-implementation-phases-and-task-dependencies)
20. [Important Technical Decisions and Rationale](#20-important-technical-decisions-and-rationale)
21. [Requirements Traceability Table](#21-requirements-traceability-table)
22. [Optional Future Improvements](#22-optional-future-improvements)

---

## 1. Project Overview

The Pizza Delivery Full-Stack Application is a production-grade, MERN-stack web platform that enables customers to build and order custom pizzas online, while providing administrators with a comprehensive dashboard for inventory management, order tracking, and automated stock notifications.

The application is submitted as the Level 3, Task 1 deliverable for the Oasis Infobyte Student Internship Program (SIP). It must be committed to a GitHub repository named `OIBSIP` under the folder path `OIBSIP/WebDev-L3-PizzaDelivery/`.

---

## 2. Project Goals and Scope

### Goals

- Implement a fully functional pizza customization and ordering flow for end-users.
- Integrate Razorpay (test mode) for payment processing with server-side signature verification.
- Provide an admin panel for inventory management and order status control.
- Automate low-stock email notifications via a scheduled cron job.
- Demonstrate real-time (or near-real-time) order status updates for the customer.

### In Scope

- User registration, email verification, login, JWT auth (httpOnly cookie), and password-reset flow.
- Separate admin authentication (not reachable from the public registration page).
- Pizza customization wizard: base → sauce → cheese → vegetables (optional selection).
- Order summary with server-computed price, Razorpay checkout (test mode), payment verification.
- Idempotent order creation: duplicate payment verification requests are rejected.
- Order status lifecycle: Order Received → In Kitchen → Sent to Delivery.
- Admin inventory dashboard: view stock, manual update, auto-decrement on order.
- Automated low-stock email alerts (node-cron + Nodemailer).
- Admin order management panel with status updates.
- Customer-facing real-time order status (polling).
- Fully responsive UI.

### Out of Scope

- Live/production Razorpay payments (test mode only).
- Delivery tracking on a map.
- Multi-restaurant or multi-vendor support.
- Customer reviews or ratings.
- Mobile native apps (iOS/Android).

---

## 3. MVP Definition

The MVP is the minimum set of features that satisfies every checklist item in the task card. All items below are **required**; none are optional.

| # | MVP Feature |
|---|---|
| 1 | User registration + email verification |
| 2 | User login / logout with JWT (httpOnly cookie) |
| 3 | Forgot-password / email reset flow |
| 4 | User dashboard showing available pizza varieties |
| 5 | 4-step pizza customization builder (base → sauce → cheese → vegetables) |
| 6 | Order summary page with server-computed price before payment |
| 7 | Razorpay test-mode checkout + server-side HMAC payment verification |
| 8 | Idempotent order confirmation (no duplicate orders on retry) |
| 9 | Order status display (Order Received → In Kitchen → Sent to Delivery) |
| 10 | Separate admin login |
| 11 | Admin inventory dashboard (bases, sauces, cheeses, vegetables) |
| 12 | Auto-decrement inventory after successful payment (atomic/guarded) |
| 13 | Manual stock update by admin |
| 14 | Automated low-stock email alert via node-cron |
| 15 | Admin order management panel + status updates |
| 16 | Real-time status propagation to customer (polling) |

---

## 4. Functional Requirements

Requirements are derived directly from the task card in the Oasis Infobyte SIP Task List PDF (Level 3, Task 1). Each is assigned a unique ID used in the Traceability Table (Section 21).

### 4.1 User-Side Requirements

| ID | Requirement |
|----|-------------|
| FR-U01 | User can register with a name, email, and password. |
| FR-U02 | Registration triggers an email verification link to the user's inbox. The account is inactive until the link is clicked. |
| FR-U03 | User can log in with email and password; the server issues a signed JWT set in an httpOnly, Secure, SameSite=Strict cookie on success. |
| FR-U04 | Every authenticated API request carries the JWT automatically via the httpOnly cookie; the frontend does not read or manage the token value directly. |
| FR-U05 | User can request a forgot-password email containing a time-limited, single-use reset link. |
| FR-U06 | Clicking the reset link opens a form to enter a new password; the token is invalidated after use or expiry. |
| FR-U07 | Authenticated user sees a dashboard displaying available pizza varieties. |
| FR-U08 | User can begin a custom pizza builder flow. |
| FR-U09 | Step 1: User selects one pizza base from 5 options. |
| FR-U10 | Step 2: User selects one sauce from 5 options. |
| FR-U11 | Step 3: User selects one cheese type. |
| FR-U12 | Step 4: User may select zero or more vegetables (multiple select). Vegetable selection is optional per the task card. See Section 18, assumption A-VEG. |
| FR-U13 | User sees an order summary page showing all selected items and the price computed server-side before payment is initiated. The frontend never supplies a price to the payment flow. |
| FR-U14 | User initiates Razorpay checkout (test mode). Clicking "Success" in the Razorpay modal triggers server-side payment verification. |
| FR-U15 | The server verifies the Razorpay HMAC-SHA256 signature using the raw secret key before recording any order. A request that fails signature verification is rejected with HTTP 400. |
| FR-U16 | User's order-status page shows the live status: `Order Received` → `In Kitchen` → `Sent to Delivery`, updated by polling every 5 seconds. |

### 4.2 Admin-Side Requirements

| ID | Requirement |
|----|-------------|
| FR-A01 | A separate admin login page exists, not linked from the user registration or login flow. |
| FR-A02 | Admin credentials are seeded into the database at setup; admins cannot self-register. |
| FR-A03 | Admin sees an inventory dashboard showing current stock levels for: pizza bases, sauces, cheeses, and vegetables. |
| FR-A04 | Inventory for each item used in an order is automatically decremented when a payment is verified successfully. Decrement happens atomically in the same database operation that confirms the order. |
| FR-A05 | Admin can manually update the stock quantity of any individual inventory item. |
| FR-A06 | A scheduled job (node-cron) periodically checks all inventory items. If any item's stock falls below a configurable threshold (default: 20 units), an aggregated email is sent to the admin. |
| FR-A07 | Admin can view a list of all incoming orders, including customer name, items ordered, total, and current status. |
| FR-A08 | Admin can update the status of any order through the lifecycle: `Order Received` → `In Kitchen` → `Sent to Delivery`. |
| FR-A09 | When admin updates an order's status, the change is reflected on the customer's order-status page within ≤ 10 seconds (via polling). |

---

## 5. User Roles and Permissions

| Role | Description | Access |
|------|-------------|--------|
| **Guest** | Unauthenticated visitor | Home/marketing page, customer login, customer registration, admin login page |
| **Customer** | Registered and email-verified user | Pizza dashboard, custom builder, order summary, Razorpay checkout, order status page, password reset |
| **Admin** | Privileged operator, seeded in DB | Admin login, inventory dashboard, manual stock update, order management panel, status updates |

**Key constraints:**
- Admin login is on a separate route (`/admin/login`) and is not linked from the customer navigation.
- JWT payloads include a `role` field (`customer` or `admin`). Route guards on both the frontend and backend enforce role-based access.
- An unverified customer account cannot access the pizza dashboard or place orders.
- A customer JWT is rejected by all `/api/admin/*` routes; an admin JWT is rejected by all `/api/orders/*` and `/api/pizza-options/*` customer routes.

---

## 6. User Flows

### 6.1 Customer Registration and Verification

```
Visit /register
  → Fill name, email, password
  → Submit → POST /api/auth/register
  → Server creates inactive account, sends verification email (Nodemailer)
  → Customer clicks link → GET /api/auth/verify-email?token=<token>
  → Account activated → Redirect to /login with success message
```

### 6.2 Customer Login

```
Visit /login
  → Fill email, password
  → Submit → POST /api/auth/login
  → Server validates credentials + isVerified === true
  → Server sets JWT in httpOnly cookie (Secure, SameSite=Strict)
  → Response body contains { success: true, user: { name, email, role } }
    (no token value in response body)
  → Frontend stores { name, email, role } in AuthContext
  → Redirect to /dashboard
```

### 6.3 Customer Logout

```
Click "Logout"
  → POST /api/auth/logout
  → Server clears the httpOnly cookie (Max-Age=0)
  → Frontend clears AuthContext
  → Redirect to /login
```

### 6.4 Forgot Password

```
Visit /forgot-password
  → Enter email → POST /api/auth/forgot-password
  → Server emails reset link regardless of whether email exists
    (prevents user enumeration)
  → Customer clicks link → Visit /reset-password?token=<token>
  → Enter new password → POST /api/auth/reset-password
  → Token nulled in DB → Redirect to /login
```

### 6.5 Pizza Customization and Order

```
/dashboard → Click "Build Your Own Pizza"
  → /builder/step1 → Select base (5 options; required)
  → /builder/step2 → Select sauce (5 options; required)
  → /builder/step3 → Select cheese (required)
  → /builder/step4 → Select vegetables (optional; 0 or more)
  → /order-summary
      → Frontend sends selections to GET /api/orders/price-preview
        or inline on the summary page via POST /api/orders/create-razorpay-order
      → Server computes total price from DB records (never trusts client price)
      → User reviews summary
  → Click "Pay Now"
      → POST /api/orders/create-razorpay-order
          { base, sauce, cheese, vegetables[] }
        Server returns { razorpayOrderId, amount, currency }
      → Razorpay modal opens (test mode)
      → Click "Success" in modal
      → Frontend receives { razorpay_order_id, razorpay_payment_id, razorpay_signature }
      → POST /api/orders/verify-payment
          { razorpayOrderId, razorpayPaymentId, razorpaySignature }
        Server verifies HMAC-SHA256 signature
        Server checks razorpayOrderId not already confirmed (idempotency)
        Server saves Order document + decrements inventory (atomic)
        Returns { success: true, orderId }
  → Redirect to /order-status/:orderId
```

### 6.6 Order Status Tracking

```
/order-status/:orderId
  → useOrderStatus hook polls GET /api/orders/:orderId/status every 5 seconds
  → Displays progress: Order Received → In Kitchen → Sent to Delivery
  → Polling stops when status reaches "Sent to Delivery"
```

### 6.7 Admin Login

```
Visit /admin/login
  → Enter admin email, password
  → POST /api/auth/admin-login
  → Server validates role === 'admin', sets JWT in httpOnly cookie
  → Response body: { success: true, admin: { name, email, role } }
  → Redirect to /admin/dashboard
```

### 6.8 Admin Inventory Management

```
/admin/inventory
  → GET /api/admin/inventory → displays all items with current stock
  → Click "Edit" on any item
  → Enter new quantity → PATCH /api/admin/inventory/:itemId
  → Stock updated in DB, table re-fetches
```

### 6.9 Admin Order Management

```
/admin/orders
  → GET /api/admin/orders → all orders, newest first
  → Select new status from dropdown → PATCH /api/admin/orders/:orderId/status
  → DB updated → customer polling detects change within ≤ 10 seconds
```

---

## 7. Technical Architecture

### 7.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Client (Browser)                     │
│  React.js SPA                                            │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Customer  │  │    Admin     │  │  Razorpay JS SDK │  │
│  │   Pages   │  │    Pages     │  │  (loads Checkout)│  │
│  └─────┬─────┘  └──────┬───────┘  └────────┬─────────┘  │
│        │  Axios         │  Axios            │            │
│        │  (withCredentials=true)            │            │
└────────┼───────────────────────────────────┼────────────┘
         │  HTTPS + httpOnly cookie           │ Razorpay
         ▼                                   │ modal
┌──────────────────────────────────────────────────────────┐
│                  Node.js + Express.js                    │
│  ┌────────────┐  ┌───────────┐  ┌──────────────────────┐ │
│  │ Auth Router│  │ Pizza /   │  │  Admin Router        │ │
│  │            │  │ Order     │  │  (inventory, orders) │ │
│  └─────┬──────┘  └─────┬─────┘  └──────────┬───────────┘ │
│        │               │                   │             │
│  ┌─────▼───────────────▼───────────────────▼──────────┐  │
│  │              Middleware Layer                       │  │
│  │  cookieParser | helmet | cors (credentials)        │  │
│  │  authMiddleware (reads httpOnly cookie)             │  │
│  │  roleGuard | rateLimiter | errorHandler             │  │
│  └─────────────────────────┬───────────────────────────┘  │
│                             │                            │
│  ┌──────────────────────────▼──────────────────────────┐  │
│  │              Service Layer                          │  │
│  │  AuthService | OrderService | InventoryService      │  │
│  │  EmailService | PaymentService                      │  │
│  └──────────────────────────┬───────────────────────────┘  │
│                             │                            │
│  ┌──────────────────────────▼──────────────────────────┐  │
│  │         node-cron (Scheduled Jobs)                  │  │
│  │  lowStockCheckJob (configurable; default 30 min)    │  │
│  └─────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────┘
                       │ Mongoose ODM
                       ▼
              ┌──────────────────┐
              │   MongoDB Atlas  │
              │   (or local      │
              │    MongoDB 7.x)  │
              └──────────────────┘

External Services:
  ┌─────────────┐   ┌────────────────────────────────┐
  │  Razorpay   │   │  SMTP Provider (Nodemailer)     │
  │  (test API) │   │  Dev: Mailtrap  |  Alt: Gmail   │
  └─────────────┘   └────────────────────────────────┘
```

### 7.2 Real-Time Communication Strategy

**Decision: HTTP Polling (5-second interval)**

The customer order-status page polls `GET /api/orders/:orderId/status` every 5 seconds. This satisfies the task card requirement ("use polling or WebSockets"), is simple to implement and verify, and requires no additional infrastructure. The endpoint is stateless and can be consumed by a WebSocket push in the future without refactoring. Polling stops automatically once the order reaches `Sent to Delivery`.

See Section 20, Decision 1 for full rationale.

### 7.3 Payment and Order Confirmation Flow (Server-Side)

```
POST /api/orders/create-razorpay-order
  1. Authenticate customer (JWT from cookie)
  2. Receive { base, sauce, cheese, vegetables[] }
  3. Look up each item in PizzaOption collection → compute totalPrice server-side
  4. Check sufficient stock for all ingredients in InventoryItem collection
     → If insufficient: return HTTP 409 { message: "Ingredient out of stock: X" }
  5. Create Razorpay order via SDK (amount = totalPrice in paise)
  6. Save Order document: { paymentStatus: 'pending', razorpayOrderId, items, totalPrice }
  7. Return { razorpayOrderId, amount, currency, orderId } to frontend

POST /api/orders/verify-payment
  1. Authenticate customer
  2. Receive { razorpayOrderId, razorpayPaymentId, razorpaySignature }
  3. Verify HMAC-SHA256 signature:
       expectedSig = HMAC(RAZORPAY_KEY_SECRET, razorpayOrderId + "|" + razorpayPaymentId)
       if (expectedSig !== razorpaySignature) → return HTTP 400 "Invalid payment signature"
  4. Load Order by razorpayOrderId — confirm it belongs to req.user
  5. Idempotency check:
       if (order.paymentStatus === 'paid') → return HTTP 200 { orderId } (already confirmed)
  6. Re-check stock levels for all order ingredients (guard against race conditions)
       → If any item now out of stock: return HTTP 409; leave order as 'pending'
  7. MongoDB transaction (if replica set available) OR compensating fallback:
       a. Set order.paymentStatus = 'paid', order.razorpayPaymentId, order.razorpaySignature
       b. Decrement currentStock for each ingredient ($inc: -1)
       c. Commit transaction
       → On failure: abort transaction; order remains 'pending'; return HTTP 500
  8. Return { success: true, orderId }
```

---

## 8. Technology Stack

| Layer | Technology | Version Target | Reason |
|-------|-----------|---------------|--------|
| Frontend framework | React.js | 18.x | Required by task card |
| Frontend routing | React Router | v6 | De-facto standard for React SPA routing |
| Frontend state | React Context + useReducer | — | Avoids Redux overhead for this scope |
| HTTP client | Axios | latest stable | `withCredentials: true` support; response interceptors |
| UI component base | Tailwind CSS | 3.x | Utility-first; fast, consistent responsive layout |
| Backend runtime | Node.js | 20.x LTS | Required by task card |
| Backend framework | Express.js | 4.x | Required by task card |
| Cookie parsing | cookie-parser | latest | Required to read httpOnly cookies in Express |
| Database | MongoDB | 7.x | Required by task card |
| ODM | Mongoose | 8.x | Schema validation, virtuals, pre-hooks, transaction support |
| Authentication | JSON Web Tokens (jsonwebtoken) | latest | Required by task card; stored in httpOnly cookie |
| Password hashing | bcryptjs | latest | Secure; pure JS (no native bindings needed) |
| Email | Nodemailer | latest | Recommended in task card self-sourcing guide |
| Payment | Razorpay Node SDK | latest | Required by task card |
| Scheduled jobs | node-cron | latest | Required by task card |
| Input validation | express-validator | latest | Declarative, middleware-friendly |
| Rate limiting | express-rate-limit | latest | Basic brute-force protection |
| Security headers | helmet | latest | Sets secure HTTP headers automatically |
| Environment config | dotenv | latest | Standard for 12-factor config |
| Dev server (backend) | nodemon | latest | Auto-reload during development |
| Dev server (frontend) | Vite | 5.x | Fast HMR; modern React tooling |
| CORS | cors (npm) | latest | `credentials: true` + `origin: CLIENT_ORIGIN` |
| Testing (backend) | Jest + Supertest | latest | Unit and integration tests for critical paths |
| Testing (frontend) | Vitest + React Testing Library | latest | Component and hook tests |

---

## 9. Database Design and Mongoose Models

### 9.1 Collections Overview

| Collection | Purpose |
|------------|---------|
| `users` | Customer accounts (including verification and reset tokens) |
| `admins` | Admin accounts (seeded, not self-registered) |
| `pizzaoptions` | Catalogue of selectable pizza components |
| `inventoryitems` | Stock levels for each ingredient |
| `orders` | Customer orders, payment status, and lifecycle status |

### 9.2 `users` Schema

```javascript
{
  name:                    { type: String, required: true, trim: true },
  email:                   { type: String, required: true, unique: true, lowercase: true },
  passwordHash:            { type: String, required: true },
  isVerified:              { type: Boolean, default: false },
  verificationToken:       { type: String, default: null },   // SHA-256 hash of UUID
  verificationTokenExpiry: { type: Date, default: null },     // 24 hours from issue
  resetToken:              { type: String, default: null },   // SHA-256 hash of UUID
  resetTokenExpiry:        { type: Date, default: null },     // 1 hour from issue
  role:                    { type: String, enum: ['customer'], default: 'customer' },
  createdAt:               { type: Date, default: Date.now },
}
```

*Tokens stored as SHA-256 hashes of the raw UUID; the raw UUID is sent in the email link. This prevents token exposure even if the `users` collection is read by an attacker.*

### 9.3 `admins` Schema

```javascript
{
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['admin'], default: 'admin' },
  createdAt:    { type: Date, default: Date.now },
}
```

*Admins are seeded via `scripts/seedAdmin.js`. No self-registration route exists.*

### 9.4 `pizzaoptions` Schema

```javascript
{
  category:    { type: String, enum: ['base', 'sauce', 'cheese', 'vegetable'], required: true },
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  basePrice:   { type: Number, default: 0 },      // price contribution in rupees (integer paise avoided at model level)
  imageUrl:    { type: String, default: '' },
  isAvailable: { type: Boolean, default: true },
}
```

*Seeded with 5 bases, 5 sauces, at least 3 cheese types, and at least 6 vegetables via `scripts/seedPizzaOptions.js`.*

### 9.5 `inventoryitems` Schema

```javascript
{
  name:               { type: String, required: true },
  category:           { type: String, enum: ['base', 'sauce', 'cheese', 'vegetable'], required: true },
  currentStock:       { type: Number, required: true, min: 0 },
  lowStockThreshold:  { type: Number, default: 20 },
  unit:               { type: String, default: 'units' },
  linkedPizzaOption:  { type: mongoose.Schema.Types.ObjectId, ref: 'PizzaOption', required: true },
  updatedAt:          { type: Date, default: Date.now },
}
```

*Each inventory item has a 1-to-1 link with a `PizzaOption` document. Index on `linkedPizzaOption` for fast lookup during order confirmation.*

### 9.6 `orders` Schema

```javascript
{
  customer:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: {
    base:        { type: mongoose.Schema.Types.ObjectId, ref: 'PizzaOption', required: true },
    sauce:       { type: mongoose.Schema.Types.ObjectId, ref: 'PizzaOption', required: true },
    cheese:      { type: mongoose.Schema.Types.ObjectId, ref: 'PizzaOption', required: true },
    vegetables:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'PizzaOption' }],
                 // Empty array is valid (vegetables are optional per task card)
  },
  totalPrice:        { type: Number, required: true },   // server-computed, in rupees
  orderStatus:       {
    type: String,
    enum: ['Order Received', 'In Kitchen', 'Sent to Delivery'],
    default: 'Order Received',
  },
  paymentStatus:     { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  razorpayOrderId:   { type: String, required: true, unique: true },  // unique index prevents duplicate confirmation
  razorpayPaymentId: { type: String, default: null },
  razorpaySignature: { type: String, default: null },
  createdAt:         { type: Date, default: Date.now },
  updatedAt:         { type: Date, default: Date.now },
}
```

**Critical indexes:**
- `razorpayOrderId`: unique index — prevents duplicate confirmed orders from retried verify-payment requests.
- `customer`: index — fast lookup of orders by user.

### 9.7 Database Prerequisites and Transaction Support

**MongoDB Atlas (default):** Atlas M0 free tier supports replica sets, which enables multi-document ACID transactions via `mongoose.startSession()`. Transactions are used in the `verify-payment` handler for atomic order confirmation + inventory decrement.

**Local MongoDB (alternative):** A standalone `mongod` instance does **not** support multi-document transactions. When `NODE_ENV=development` and `MONGO_URI` points to a standalone instance, the application falls back to a sequenced write strategy:
1. Increment order `paymentStatus` to `'paid'` first.
2. Decrement inventory items individually.
3. If any inventory write fails after the order is confirmed, a compensating log entry is written and the admin is alerted via email, but the order remains confirmed (payment already processed).

The fallback behavior is documented in `config/constants.js` as `TRANSACTION_AVAILABLE` (boolean, set at startup by probing the connection's `topology.description.type`).

**For production use, a replica set is required.** The `.env.example` includes instructions.

---

## 10. API Structure and Endpoint Responsibilities

### Base URL: `/api`

All routes return JSON. Errors follow `{ success: false, message: "...", errors: [...] }`. Successes follow `{ success: true, data: {...} }`.

Authentication is carried via the httpOnly cookie on every request. The frontend sends all requests with `withCredentials: true` (Axios) so the browser includes the cookie automatically.

### 10.1 Auth Routes (`/api/auth`)

| Method | Path | Auth Required | Cookie Action | Description |
|--------|------|--------------|--------------|-------------|
| POST | `/register` | None | — | Register new customer; send verification email |
| GET | `/verify-email` | None | — | Verify `?token=<rawUUID>`; activate account |
| POST | `/login` | None | Set JWT cookie | Customer login; sets httpOnly cookie |
| POST | `/admin-login` | None | Set JWT cookie | Admin login; sets httpOnly cookie with role=admin |
| POST | `/logout` | Customer cookie | Clear cookie | Clears JWT cookie (Max-Age=0) |
| POST | `/admin-logout` | Admin cookie | Clear cookie | Clears admin JWT cookie |
| POST | `/forgot-password` | None | — | Send password-reset email (always 200; no user enumeration) |
| POST | `/reset-password` | None | — | Consume reset token, update password |
| GET | `/me` | Customer cookie | — | Return authenticated user profile |

**Cookie settings (set on login and admin-login):**
```
Set-Cookie: token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800
```
- `HttpOnly`: JavaScript cannot access the token value.
- `Secure`: Cookie only sent over HTTPS (also sent over HTTP in development if `NODE_ENV !== 'production'` — see Section 13).
- `SameSite=Strict`: Cookie is not sent on cross-site requests, providing CSRF protection.
- `Path=/`: Cookie applies to all routes.
- `Max-Age=604800`: 7 days, matching `JWT_EXPIRY`.

### 10.2 Pizza Options Routes (`/api/pizza-options`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Customer cookie | Get all available pizza options (all categories) |
| GET | `/:category` | Customer cookie | Get options filtered by `base`/`sauce`/`cheese`/`vegetable` |

### 10.3 Order Routes (`/api/orders`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/create-razorpay-order` | Customer cookie | Validate items; compute price server-side; create Razorpay order; save pending Order doc |
| POST | `/verify-payment` | Customer cookie | Verify HMAC sig; idempotency check; atomic order confirm + inventory decrement |
| GET | `/my-orders` | Customer cookie | List authenticated customer's orders (newest first) |
| GET | `/:orderId/status` | Customer cookie | Return `orderStatus` for polling; validates order belongs to req.user |

**Order creation guards (in `create-razorpay-order`):**
- All IDs (`base`, `sauce`, `cheese`) are required and must exist in `pizzaoptions`.
- `vegetables` array may be empty.
- Price is computed from DB `basePrice` fields — client-supplied prices are ignored.
- Stock is checked before creating the Razorpay order; insufficient stock returns HTTP 409.

**Payment verification guards (in `verify-payment`):**
- Signature verified before any DB write.
- `razorpayOrderId` uniqueness index prevents double-confirmation.
- Stock re-checked inside transaction to prevent race conditions.

### 10.4 Admin Routes (`/api/admin`)

All admin routes require an httpOnly cookie JWT with `role === 'admin'`, enforced by `requireAdmin` middleware.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/inventory` | Admin cookie | Get all inventory items with current stock |
| PATCH | `/inventory/:itemId` | Admin cookie | Manually set stock quantity; body: `{ currentStock: Number }` |
| GET | `/orders` | Admin cookie | All orders, newest first, with customer and item details populated |
| PATCH | `/orders/:orderId/status` | Admin cookie | Update `orderStatus`; body: `{ status: 'In Kitchen' \| 'Sent to Delivery' }` |

### 10.5 Scheduled Job (not an HTTP endpoint)

File: `src/jobs/lowStockCheck.js`

- Schedule: configured by `CRON_SCHEDULE` env var (default `*/30 * * * *` = every 30 minutes).
- Logic: query `InventoryItem` where `currentStock < lowStockThreshold`.
- Action: send one aggregated email to `ADMIN_ALERT_EMAIL` listing all below-threshold items with current counts and thresholds.
- Email is sent only when at least one item is below threshold.
- Errors in the job are logged to `console.error` and do not crash the server process.

---

## 11. Frontend and Backend Folder Structure

### 11.1 Repository Root

```
OIBSIP/WebDev-L3-PizzaDelivery/
├── client/                  # React frontend (Vite)
├── server/                  # Node.js + Express backend
├── .gitignore
├── README.md
└── project_plan.md
```

### 11.2 Backend (`server/`)

```
server/
├── src/
│   ├── config/
│   │   ├── constants.js       # LOW_STOCK_DEFAULT, JWT_EXPIRY, COOKIE_OPTIONS, etc.
│   │   ├── db.js              # Mongoose connection; probes transaction support
│   │   └── razorpay.js        # Razorpay SDK init
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── pizzaOptions.controller.js
│   │   ├── order.controller.js
│   │   └── admin.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js  # Reads JWT from req.cookies.token; attaches req.user
│   │   ├── role.middleware.js  # requireRole('admin') / requireRole('customer')
│   │   ├── validate.middleware.js
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── User.model.js
│   │   ├── Admin.model.js
│   │   ├── PizzaOption.model.js
│   │   ├── InventoryItem.model.js
│   │   └── Order.model.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── pizzaOptions.routes.js
│   │   ├── order.routes.js
│   │   └── admin.routes.js
│   ├── services/
│   │   ├── email.service.js       # Nodemailer; SMTP config from env
│   │   ├── payment.service.js     # Razorpay order creation + HMAC verify
│   │   └── inventory.service.js   # Stock check + atomic decrement
│   ├── jobs/
│   │   └── lowStockCheck.js       # node-cron scheduled job
│   ├── scripts/
│   │   ├── seedAdmin.js           # One-time admin seed
│   │   └── seedPizzaOptions.js    # Seed pizza options + inventory items
│   ├── utils/
│   │   ├── generateToken.js       # crypto.randomBytes raw UUID + SHA-256 hash
│   │   ├── jwt.js                 # sign / verify wrappers; cookie helper
│   │   └── apiResponse.js         # Standardised { success, data/message } helpers
│   └── app.js                     # Express app setup (no listen); applies all middleware
├── server.js                      # Entry point: DB connect, then app.listen
├── .env.example
└── package.json
```

### 11.3 Frontend (`client/`)

```
client/
├── public/
│   └── favicon.ico
├── src/
│   ├── api/
│   │   ├── axios.js           # Axios instance: baseURL, withCredentials: true
│   │   ├── auth.api.js
│   │   ├── pizza.api.js
│   │   ├── order.api.js
│   │   └── admin.api.js
│   ├── components/
│   │   ├── common/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── LoadingSpinner.jsx
│   │   │   └── ProtectedRoute.jsx  # Checks AuthContext; redirects if unauthenticated
│   │   ├── builder/
│   │   │   ├── StepBase.jsx
│   │   │   ├── StepSauce.jsx
│   │   │   ├── StepCheese.jsx
│   │   │   └── StepVegetables.jsx  # Optional multi-select; 0 selections allowed
│   │   └── admin/
│   │       ├── InventoryTable.jsx
│   │       └── OrdersTable.jsx
│   ├── context/
│   │   ├── AuthContext.jsx        # Stores { name, email, role }; no token value
│   │   └── OrderContext.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   └── useOrderStatus.js      # Polling hook; auto-stops at 'Sent to Delivery'
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Register.jsx
│   │   ├── Login.jsx
│   │   ├── VerifyEmail.jsx
│   │   ├── ForgotPassword.jsx
│   │   ├── ResetPassword.jsx
│   │   ├── Dashboard.jsx
│   │   ├── PizzaBuilder.jsx
│   │   ├── OrderSummary.jsx
│   │   ├── OrderStatus.jsx
│   │   └── admin/
│   │       ├── AdminLogin.jsx
│   │       ├── AdminDashboard.jsx
│   │       ├── AdminInventory.jsx
│   │       └── AdminOrders.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── vite.config.js              # proxy /api → http://localhost:5000 (dev only)
├── tailwind.config.js
└── package.json
```

**Vite proxy note (demo scope):** In development, `vite.config.js` proxies `/api` requests to `http://localhost:5000`. This makes the browser treat both frontend and backend as the same origin, so `SameSite=Strict` cookies work without needing `SameSite=None`.

> ⚠ **This configuration is not universally production-ready.** It is the correct and intentional setup for this internship demo. Any deployment that places the frontend and backend on separate origins (e.g., `app.example.com` and `api.example.com`) requires `SameSite=None; Secure` cookies, which removes the cookie-based CSRF protection. Before any such deployment, CSRF protection (e.g., Double-Submit Cookie pattern) must be implemented and tested. See §13 and §22.

---

## 12. UI/UX and Responsive Design Principles

### 12.1 Layout

- Mobile-first responsive design using Tailwind CSS breakpoints (`sm`, `md`, `lg`).
- Minimum supported viewport: 375 px (iPhone SE).
- Navigation: sticky top navbar with Dashboard, My Orders, and Logout (customer); separate admin navbar.
- No horizontal scrolling at any breakpoint.

### 12.2 Pizza Builder

- Multi-step wizard with a progress indicator (Step 1 of 4, etc.).
- Each step shows option cards (image + name + price contribution).
- "Back" and "Next" buttons; "Next" is disabled until a required selection is made (base, sauce, cheese).
- Step 4 (vegetables) shows a "Skip" option making clear that selection is optional; the "Next/Order" button is always enabled on step 4.

### 12.3 Order Summary Page

- Displays all selected items; vegetables section shows "None selected" if empty.
- Total price fetched from the server (not computed client-side).
- "Pay Now" button initiates the Razorpay modal.

### 12.4 Order Status Page

- Clear visual status tracker with three stages.
- Refreshes via polling without full page reload.
- Displays a final confirmation message when status is `Sent to Delivery`.

### 12.5 Admin Dashboard

- Table-based layouts for inventory and orders.
- Inline edit fields for stock quantities.
- Status dropdown for in-place order status changes.
- Low-stock items highlighted visually (e.g., red badge on quantity).

### 12.6 Accessibility

- Semantic HTML (`<nav>`, `<main>`, `<form>`, `<button>`, etc.).
- All form inputs have associated `<label>` elements.
- Color contrast meets WCAG AA for text (minimum 4.5:1 ratio).
- Focus-visible outlines preserved for keyboard navigation.
- ARIA labels on icon-only buttons.

*Note: Full WCAG compliance requires manual testing with assistive technologies, beyond the scope of this internship project.*

### 12.7 Brand / Color Palette (Proposed)

| Role | Color |
|------|-------|
| Primary | `#E63946` (tomato red) |
| Secondary | `#F4A261` (warm orange) |
| Background | `#FFFCF2` (off-white) |
| Text | `#1A1A2E` (near-black) |
| Admin accent | `#2B2D42` (dark navy) |

---

## 13. Security Requirements

| Area | Requirement |
|------|-------------|
| **Passwords** | Hashed with `bcryptjs`, salt rounds ≥ 12. Never stored, returned, or logged as plain text. |
| **JWT storage** | JWT stored in an `httpOnly` cookie. The token value is never exposed in response bodies, localStorage, or JavaScript variables. |
| **JWT properties** | Signed with `HS256`. Secret key ≥ 64 random characters (`JWT_SECRET` env var). Payload contains `{ id, role }` only. Expiry: 7 days (`JWT_EXPIRY` env var). |
| **Cookie settings** | `HttpOnly: true`, `Secure: true` (relaxed to `false` in `NODE_ENV=development` to allow HTTP on localhost), `SameSite=Strict` for the Vite-proxy dev setup. `Path=/`, `Max-Age` matches `JWT_EXPIRY`. |
| **CSRF protection — demo scope** | The internship demo uses the Vite proxy so both frontend and backend share the same origin. `SameSite=Strict` provides CSRF protection in this configuration and no additional CSRF token is required. **This setup is not universally production-ready.** Any deployment that requires cross-site cookies (`SameSite=None`) loses this protection; a CSRF token mechanism must be added before such a deployment. See §22 for the future-improvement entry. |
| **CORS** | Backend `cors` configured with `origin: CLIENT_ORIGIN` (from env) and `credentials: true`. No wildcard `*` allowed when credentials are true. |
| **Email tokens** | Raw UUID generated with `crypto.randomBytes(32).toString('hex')`. Stored in DB as `SHA-256(rawToken)`. Link contains raw token. Verification tokens expire in 24 h; reset tokens in 1 h. Tokens are nulled in DB after use. |
| **Payment** | Razorpay HMAC-SHA256 signature verified server-side using `RAZORPAY_KEY_SECRET` before any order write. Raw secret never sent to the frontend. Client-supplied prices are ignored; price is always recomputed from DB. |
| **Idempotency** | `razorpayOrderId` has a unique index on the `orders` collection. A second verify-payment request for the same order ID returns 200 (already confirmed) without duplicating the order or re-decrementing inventory. |
| **Input validation** | All API inputs validated with `express-validator`. Mongoose schema typing provides a second layer. No raw string interpolation in queries. |
| **Rate limiting** | `express-rate-limit` on all `/api/auth/*` routes: max 10 requests per 15-minute window per IP. |
| **HTTP headers** | `helmet` middleware applied to all routes in `app.js`. |
| **Admin isolation** | `/api/admin/*` routes require `role === 'admin'` in the JWT, enforced by `requireAdmin` middleware. Admin login is at `/api/auth/admin-login` and `/admin/login`, not linked from customer navigation. |
| **Environment secrets** | `.env` in `.gitignore`. `.env.example` with placeholder values is committed. `RAZORPAY_KEY_SECRET` and `JWT_SECRET` are never logged. |

---

## 14. Coding Standards and Maintainability

- **Language**: JavaScript (ES2022+). CommonJS (`require`) on the backend; ES Modules (`import`) on the frontend.
- **Linting**: ESLint (Airbnb-base for backend; Airbnb React for frontend).
- **Formatting**: Prettier with default settings; auto-format on save.
- **Naming**: camelCase for variables and functions; PascalCase for React components and Mongoose model names; SCREAMING_SNAKE_CASE for env variable names and constants.
- **Thin controllers**: Business logic lives in service files (`services/`), not in controllers.
- **No magic numbers**: All configurable constants defined in `src/config/constants.js` (e.g., `LOW_STOCK_DEFAULT = 20`, `JWT_EXPIRY = '7d'`, `COOKIE_MAX_AGE = 604800`).
- **JSDoc comments** on all exported functions and Mongoose schemas.
- **Git commits**: Conventional Commits format (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, etc.).

---

## 15. Error Handling, Validation, and Logging

### 15.1 Backend Error Handling

- All async controller functions wrapped in an `asyncHandler` higher-order function that passes errors to `next()`.
- Unhandled errors bubble to centralized `errorHandler.js` Express middleware (registered last in `app.js`).
- Error type mappings:
  - Mongoose `ValidationError` / `CastError` → HTTP 400
  - JWT `JsonWebTokenError` / `TokenExpiredError` → HTTP 401 (cookie cleared in response)
  - `express-validator` failures → HTTP 422 with `errors` array
  - Razorpay signature mismatch → HTTP 400
  - Duplicate key (Mongoose `11000`) → HTTP 409
  - Unhandled → HTTP 500 (generic message in production; stack trace in development)
- All error responses: `{ success: false, message: "...", errors: [...] }`.

### 15.2 Payment-Specific Error Handling

| Scenario | Server Response | Order State |
|----------|----------------|------------|
| Invalid HMAC signature | HTTP 400 | Remains `pending` |
| `razorpayOrderId` already `paid` | HTTP 200 + `orderId` | Unchanged (idempotent) |
| Insufficient stock (pre-payment check) | HTTP 409 | No order created |
| Insufficient stock (race, during verify) | HTTP 409 | Remains `pending` |
| DB transaction failure | HTTP 500 | Remains `pending` (no money taken — Razorpay order was created but order not confirmed) |
| Razorpay SDK error on order creation | HTTP 502 | No order created |

### 15.3 Input Validation

- `express-validator` chains on every route that accepts a request body.
- Client-side form validation mirrors server rules for fast user feedback but is not trusted server-side.

### 15.4 Logging

- `morgan` in `dev` format during development.
- `console.error` for server errors in development.
- Sensitive values (passwords, tokens, payment keys) are never logged.
- A structured logger (`winston`) is documented as a future production upgrade (Section 22).

---

## 16. Testing Strategy and Acceptance Criteria

### 16.1 Testing Approach

The testing strategy is proportionate to the internship scope and covers the critical paths most likely to have correctness issues:

| Layer | Tool | Scope |
|-------|------|-------|
| Backend unit + integration | Jest + Supertest | Auth flows, payment verification, inventory logic |
| Frontend component/hook | Vitest + React Testing Library | Builder state, ProtectedRoute, polling hook |
| API manual testing | Postman collection | All endpoints; happy paths + error paths |
| Manual end-to-end | Browser (Chrome) | Full user journey; admin journey; email flows |

**What is automated vs. manual:**

- **Automated (no external services needed):** Unit tests for JWT utility, password hashing, HMAC verification logic, inventory decrement, idempotency guard, and API routes (using in-memory MongoDB via `mongodb-memory-server`).
- **Automated (requires Razorpay test credentials):** Integration test for `verify-payment` using Razorpay test keys to generate a valid signature and confirm the full server flow. Skipped if `RAZORPAY_KEY_ID` is not set in the test environment.
- **Manual (requires email credentials):** Verification email delivery, password reset email delivery, and low-stock cron email. Tested using a Mailtrap inbox in development — no real email required.
- **Manual E2E (full stack):** Razor pay modal, order-status polling, admin status update propagation.

### 16.2 Backend Test Coverage Targets

| Module | What is tested | Type |
|--------|---------------|------|
| `POST /api/auth/register` | Creates user; rejects duplicate email; sends verification token | Integration |
| `GET /api/auth/verify-email` | Valid token activates account; expired token rejected; token nulled after use | Integration |
| `POST /api/auth/login` | Correct credentials set cookie; wrong credentials return 401; unverified account rejected | Integration |
| `POST /api/auth/logout` | Cookie cleared | Integration |
| `POST /api/auth/forgot-password` | Always returns 200; only sends email if account exists | Integration |
| `POST /api/auth/reset-password` | Valid token updates password; expired token rejected; token single-use | Integration |
| `POST /api/orders/create-razorpay-order` | Rejects unauthenticated; rejects missing base/sauce/cheese; uses DB price (ignores client price); rejects out-of-stock items | Integration |
| `POST /api/orders/verify-payment` | Valid signature → order confirmed + inventory decremented; invalid signature → rejected; duplicate `razorpayOrderId` → idempotent 200 | Integration |
| `PATCH /api/admin/orders/:id/status` | Customer JWT rejected; admin JWT accepted; valid status transitions | Integration |
| `PATCH /api/admin/inventory/:id` | Updates `currentStock`; rejects negative values | Integration |
| HMAC verification | Correct vs. tampered signature | Unit |
| Inventory decrement | Correct items decremented; vegetables empty array handled | Unit |

### 16.3 Acceptance Criteria Per Feature

Test type key: **[A]** = Automated test | **[M]** = Manual test | **[E]** = Requires external service credentials

| ID | Feature | Acceptance Criterion | Test Type |
|----|---------|---------------------|-----------|
| FR-U01 | Registration | POST `/api/auth/register` returns 201; DB has user with `isVerified: false` | [A] |
| FR-U02 | Email verification | Verification email arrives in Mailtrap inbox; clicking link returns 200 and sets `isVerified: true`; second click returns error | [A] + [E] |
| FR-U03 | Login | Valid credentials set httpOnly cookie; response body has `{ user }` (no token); wrong credentials return 401 | [A] |
| FR-U04 | Cookie auth | Authenticated request with cookie succeeds; request without cookie returns 401 | [A] |
| FR-U05 | Forgot-password | Always returns 200; reset email arrives in Mailtrap | [A] + [E] |
| FR-U06 | Password reset | New password accepted; old password rejected; token nulled; expired token rejected | [A] |
| FR-U07 | Dashboard | Dashboard renders pizza options fetched from `/api/pizza-options` | [M] |
| FR-U08 | Start builder | "Build Your Own" navigates to step 1 | [M] |
| FR-U09 | Step 1: Base | 5 bases shown; Next disabled until one selected | [M] |
| FR-U10 | Step 2: Sauce | 5 sauces shown; Next disabled until one selected | [M] |
| FR-U11 | Step 3: Cheese | Cheese options shown; Next disabled until one selected | [M] |
| FR-U12 | Step 4: Vegetables | Multi-select shown; "Skip" / 0 selections allowed; Next always enabled | [M] |
| FR-U13 | Order summary | All selections displayed; price matches server-computed total | [M] |
| FR-U14 | Razorpay checkout | Razorpay modal opens; Success click triggers verify-payment | [M] + [E] |
| FR-U15 | Payment verification | Server HMAC check passes; order saved with `paymentStatus: 'paid'`; duplicate request returns 200 without re-decrement | [A] + [E] |
| FR-U16 | Order status polling | Status change by admin reflected on customer page within ≤ 10 s | [M] |
| FR-A01 | Admin login page | `/admin/login` not linked from customer nav | [M] |
| FR-A02 | Admin auth | Customer JWT rejected on `/api/admin/*`; admin JWT accepted | [A] |
| FR-A03 | Inventory dashboard | All items with stock counts visible | [M] |
| FR-A04 | Auto-decrement | After verify-payment, each used item's `currentStock` decremented by 1; vegetables empty → no vegetable decrement | [A] |
| FR-A05 | Manual stock update | PATCH updates DB; UI reflects change; negative stock rejected | [A] + [M] |
| FR-A06 | Cron email | Mailtrap receives aggregated low-stock email after cron fires with below-threshold items | [M] + [E] |
| FR-A07 | View orders | All orders visible at `/admin/orders` with populated customer + items | [M] |
| FR-A08 | Update order status | PATCH persists new status in DB | [A] |
| FR-A09 | Real-time reflection | Customer page detects admin status update within 5-10 seconds | [M] |

---

## 17. Environment Variables and External Service Configuration

### 17.1 Backend `.env` Variables

```dotenv
# ── Server ──────────────────────────────────────────────
PORT=5000
NODE_ENV=development

# ── MongoDB ─────────────────────────────────────────────
# Default: Atlas (replica set — required for transactions)
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/pizza-delivery
# Alternative for local development (no transaction support):
# MONGO_URI=mongodb://localhost:27017/pizza-delivery

# ── JWT ──────────────────────────────────────────────────
JWT_SECRET=<random-64-char-string>
JWT_EXPIRY=7d

# ── CORS / Email links ───────────────────────────────────
CLIENT_ORIGIN=http://localhost:5173

# ── Email (Nodemailer) ───────────────────────────────────
# Development default: Mailtrap
EMAIL_HOST=sandbox.smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=<mailtrap-username>
EMAIL_PASS=<mailtrap-password>
# Alternative (Gmail):
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_USER=your-gmail@gmail.com
# EMAIL_PASS=<gmail-app-password>

EMAIL_FROM=noreply@pizzaapp.dev
ADMIN_ALERT_EMAIL=admin@example.com

# ── Razorpay (test mode) ─────────────────────────────────
RAZORPAY_KEY_ID=rzp_test_<your-key-id>
RAZORPAY_KEY_SECRET=<your-key-secret>

# ── Cron ─────────────────────────────────────────────────
CRON_SCHEDULE=*/30 * * * *
LOW_STOCK_THRESHOLD=20
```

### 17.2 Frontend `.env` Variables (Vite)

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=rzp_test_<your-key-id>
```

*Note: `VITE_RAZORPAY_KEY_ID` is the **public** key ID only. The secret is never placed in the frontend environment.*

### 17.3 External Service Setup

| Service | Setup Steps |
|---------|-------------|
| **MongoDB Atlas** | Create free M0 cluster → enable replica set (M0 includes this by default) → whitelist IP or use `0.0.0.0/0` for dev → copy connection string into `MONGO_URI` |
| **MongoDB local** | Install MongoDB 7.x → start with `mongod --replSet rs0` and run `rs.initiate()` for transaction support, or use plain `mongod` and accept the fallback strategy |
| **Mailtrap (dev email)** | Create free Mailtrap account → create inbox → copy SMTP credentials into `EMAIL_HOST/PORT/USER/PASS` → all outbound emails appear in the Mailtrap inbox |
| **Gmail (alt)** | Enable 2FA on Google account → generate App Password → use in `EMAIL_PASS` |
| **Razorpay** | Create account → Dashboard → Settings → API Keys → generate test mode keys → copy into `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (no KYC needed for test mode) |

### 17.4 Email Testing by Feature

| Feature | How to Test in Dev |
|---------|-------------------|
| Verification email | Register a new user; check Mailtrap inbox for the verification link |
| Password reset email | Submit forgot-password form; check Mailtrap inbox for the reset link |
| Low-stock cron | Manually set any inventory item's `currentStock` below `LOW_STOCK_THRESHOLD`; wait for next cron run (or temporarily set `CRON_SCHEDULE=* * * * *` for 1-min intervals) |

---

## 18. Constraints and Assumptions

| # | Constraint / Assumption |
|---|------------------------|
| C1 | Razorpay runs in **test mode** only. No live payments. |
| C2 | Email flows require a functioning outbound SMTP service. Mailtrap is the default for development; no real emails are sent. |
| C3 | The application is a **single-server monolith** (one Express app, one Vite dev server). No microservices. |
| C4 | Inventory is decremented by **1 unit per ingredient** per order (1 base, 1 sauce, 1 cheese, and 1 unit per vegetable selected). This is a deliberate simplification; real-world recipes use variable quantities. |
| C5 | Admin accounts are created only via `scripts/seedAdmin.js`. There is no admin self-registration endpoint. |
| C6 | The AI Development Workflow PDF was **not found** in the workspace. The workflow instructions provided in the user prompt are followed as the authoritative process: plan first → await approval → implement in phases → update progress tracker. |
| C7 | Minimum seed data: 5 bases, 5 sauces, 3 cheese types, 6 vegetables. |
| C8 | Targeted browsers: Chrome 115+, Firefox 115+, Safari 16+. No IE11 support. |
| C9 | GitHub submission folder: `OIBSIP/WebDev-L3-PizzaDelivery/`. |
| C10 | Real-time order updates use **polling** (5-second interval). WebSockets are a future improvement. |
| C11 | MongoDB Atlas M0 (default) supports replica sets and therefore MongoDB multi-document transactions. The `db.js` startup probe sets `TRANSACTION_AVAILABLE`; local standalone MongoDB uses the compensating write fallback. |
| **A-VEG** | **Vegetable selection is optional.** The original task card says "Step 4: Choose vegetables (multiple select)" — it does not say "at least one required." The plan therefore treats an empty vegetable array as valid. The previous revision required at least one vegetable; that was a plan-imposed constraint not present in the assignment. All references to a vegetable minimum have been removed and replaced with optional behavior. |

---

## 19. Implementation Phases and Task Dependencies

> **Implementation does not begin until this plan is approved by the project owner.**

### Phase 1 — Project Scaffold and Infrastructure

- Initialize `server/` (Express app, full folder structure, ESLint/Prettier, nodemon, helmet, cors, cookie-parser, morgan).
- Initialize `client/` (Vite + React, Tailwind CSS, full folder structure).
- Configure Mongoose connection with transaction-support probe.
- Configure environment variables, `.gitignore`, `.env.example`.
- First Git commit: scaffold only, no business logic.

**Dependency:** None.

### Phase 2 — Authentication System

- Mongoose models: `User`, `Admin`.
- `jwt.js` utility (sign/verify/cookie helpers), `asyncHandler`, `errorHandler`, `apiResponse`.
- Routes + controllers: `register`, `verify-email`, `login`, `admin-login`, `logout`, `admin-logout`, `forgot-password`, `reset-password`, `me`.
- Email service (Nodemailer): verification email, password-reset email (SMTP config from env; Mailtrap by default).
- `auth.middleware.js` (reads httpOnly cookie), `role.middleware.js`.
- Rate limiting on all `/api/auth/*` routes.
- Frontend: Register, Login, VerifyEmail, ForgotPassword, ResetPassword pages.
- `AuthContext` (stores `{ name, email, role }` — no token), `ProtectedRoute`.
- Axios instance with `withCredentials: true`; Vite proxy configured.
- **Automated tests**: auth integration tests (register, verify, login, logout, forgot, reset).

**Dependency:** Phase 1 complete.

### Phase 3 — Pizza Options and Inventory Models

- Mongoose models: `PizzaOption`, `InventoryItem`.
- Seed scripts: `seedAdmin.js`, `seedPizzaOptions.js` (5 bases, 5 sauces, 3+ cheeses, 6+ vegetables + matching inventory items).
- Routes + controllers: `GET /api/pizza-options`, `GET /api/pizza-options/:category`.
- Frontend: Dashboard page (fetches and displays pizza options).

**Dependency:** Phase 2 complete (auth middleware needed to protect routes).

### Phase 4 — Pizza Builder, Order Flow, and Payment

- `Order` model with unique index on `razorpayOrderId`.
- `PaymentService` (Razorpay SDK: order creation + HMAC verification).
- `InventoryService` (stock check, atomic decrement with transaction or fallback).
- Routes + controllers: `create-razorpay-order`, `verify-payment`, `my-orders`, `:orderId/status`.
- Frontend: PizzaBuilder wizard (4 steps; vegetables optional), OrderSummary (server-computed price), Razorpay modal integration.
- **Automated tests**: `create-razorpay-order` (price from DB, out-of-stock rejection), `verify-payment` (HMAC valid/invalid, idempotency, inventory decrement).

**Dependency:** Phase 3 complete.

### Phase 5 — Order Status Tracking

- `useOrderStatus` polling hook (5-second interval; stops at `Sent to Delivery`).
- `OrderStatus` page with visual progress bar.
- Polling validates `orderId` belongs to the authenticated user (server-side check on `GET /:orderId/status`).

**Dependency:** Phase 4 complete.

### Phase 6 — Admin Panel

- `requireAdmin` middleware.
- Routes + controllers: `GET /api/admin/inventory`, `PATCH /api/admin/inventory/:itemId`, `GET /api/admin/orders`, `PATCH /api/admin/orders/:orderId/status`.
- Frontend: AdminLogin, AdminDashboard, AdminInventory (inline edit), AdminOrders (status dropdown).
- **Automated tests**: admin auth guard (customer JWT rejected), order status update, inventory update.

**Dependency:** Phase 4 complete.

### Phase 7 — Scheduled Job and Low-Stock Email

- `lowStockCheck.js` node-cron job with configurable `CRON_SCHEDULE`.
- Aggregated low-stock email template (Nodemailer).
- Manual verification: set stock below threshold in Mailtrap inbox; confirm email received.

**Dependency:** Phase 6 complete (inventory model and email service exist).

### Phase 8 — Polish, Responsiveness, and Final Prep

- Responsive audit across all Tailwind breakpoints.
- Accessibility quick-check (semantic HTML, label associations, focus outlines, contrast).
- `README.md` with setup instructions (seed scripts, env vars, Mailtrap/Razorpay setup), screenshots.
- Final `.env.example` review.
- Verify GitHub folder path: `OIBSIP/WebDev-L3-PizzaDelivery/`.
- Demo video checklist per SIP requirements (title card: name + track + task title).

**Dependency:** Phases 1–7 complete.

---

## 20. Important Technical Decisions and Rationale

### Decision 1: Polling vs. WebSockets for Order Status

**Chosen:** HTTP Polling (5-second interval on `GET /api/orders/:orderId/status`).

**Rationale:** The task card explicitly names "polling or WebSockets" as acceptable. Polling is simpler to implement and verify in a demo context, requires no additional server infrastructure, and is fully sufficient for a status that changes at most twice per order (3 states). The polling hook auto-stops at the final state. The status endpoint is stateless and compatible with a WebSocket push in the future.

### Decision 2: JWT Storage — httpOnly Cookie

**Chosen:** `httpOnly` cookie (revised from localStorage in revision 1).

**Rationale:** httpOnly cookies are immune to XSS token theft because JavaScript cannot access them. `SameSite=Strict` provides CSRF protection in the Vite-proxy dev setup where front and back share an origin. The tradeoff is that `withCredentials: true` must be set on all Axios requests and the backend CORS must specify an explicit origin (not `*`). This is a well-understood configuration and the correct choice for this application.

**Demo-scope note:** This configuration is intentional and sufficient for the internship demo. It is not universally production-ready: a cross-origin production deployment would require `SameSite=None; Secure` and a CSRF token mechanism. That work is deferred to §22 Future Improvements and must be completed before any cross-origin deployment.

### Decision 3: Monorepo Structure

**Chosen:** `client/` and `server/` under the same submission folder.

**Rationale:** The SIP submission requires a single GitHub folder (`OIBSIP/WebDev-L3-PizzaDelivery/`). A monorepo simplifies the shared `.gitignore`, README, and project plan.

### Decision 4: Tailwind CSS vs. a Component Library

**Chosen:** Tailwind CSS utility classes, no pre-built component library.

**Rationale:** Avoids large bundle size (e.g., Material UI ~300 KB gzipped). Full design control with minimal configuration. Sufficient for this project's UI complexity.

### Decision 5: Vite vs. Create React App

**Chosen:** Vite.

**Rationale:** CRA is officially deprecated. Vite is the current community standard, offers significantly faster HMR, and is supported by the React team.

### Decision 6: Mailtrap as Default Development Email Provider

**Chosen:** Mailtrap for development; any SMTP provider via env vars for production.

**Rationale:** Mailtrap captures all outbound emails in a test inbox with no risk of sending real emails to real addresses during development. It requires zero DNS configuration. The SMTP configuration is fully env-var-driven, so switching to Gmail, SendGrid, or any other provider requires only environment variable changes — no code changes.

### Decision 7: Token Storage in DB as SHA-256 Hash

**Chosen:** Store the SHA-256 hash of the raw token in the database; send the raw token in the email link.

**Rationale:** If the `users` collection were ever read by an attacker (e.g., via a NoSQL injection that bypassed Mongoose), they would only obtain hashed tokens, not the raw values needed to activate accounts or reset passwords. This is the same pattern used for password reset tokens in production systems (e.g., Laravel, Devise).

### Decision 8: Vegetable Selection is Optional

**Chosen:** Empty vegetable array is valid in the order model and the builder UI.

**Rationale:** The task card states "Step 4: Choose vegetables (multiple select)" — it does not include a minimum-selection requirement. The previous revision assumed at least one vegetable was required; this was a plan-imposed constraint absent from the assignment. Making it optional is more faithful to the specification and more realistic (a customer may simply not want vegetables). See assumption A-VEG in Section 18.

---

## 21. Requirements Traceability Table

| Req. ID | Requirement Description | Plan Section(s) | Phase | Verifiable Acceptance Criterion | Test Type |
|---------|------------------------|----------------|-------|-------------------------------|-----------|
| FR-U01 | User registration | §4.1, §10.1 | 2 | POST `/api/auth/register` → 201; DB user `isVerified: false` | [A] |
| FR-U02 | Email verification | §4.1, §10.1, §17.4 | 2 | Email in Mailtrap; link → `isVerified: true`; second link → error | [A]+[E] |
| FR-U03 | JWT login via cookie | §4.1, §10.1, §13 | 2 | Valid creds → httpOnly cookie set; body has `{ user }`, no token value | [A] |
| FR-U04 | Cookie-based auth on requests | §6.2, §11.3, §13 | 2 | Request with cookie → 200; request without cookie → 401 | [A] |
| FR-U05 | Forgot-password email | §4.1, §10.1, §17.4 | 2 | Always 200; email arrives in Mailtrap when account exists | [A]+[E] |
| FR-U06 | Password reset | §4.1, §10.1 | 2 | New password works; old rejected; token nulled; expired token rejected | [A] |
| FR-U07 | Dashboard with pizza options | §4.1, §10.2 | 3 | Dashboard renders options from `/api/pizza-options` | [M] |
| FR-U08 | Start builder flow | §4.1, §6.5 | 4 | "Build Your Own" → `/builder/step1` | [M] |
| FR-U09 | Step 1: Base | §4.1, §9.4 | 4 | 5 bases shown; exactly one selectable; Next disabled until chosen | [M] |
| FR-U10 | Step 2: Sauce | §4.1, §9.4 | 4 | 5 sauces shown; exactly one selectable | [M] |
| FR-U11 | Step 3: Cheese | §4.1, §9.4 | 4 | Cheese options shown; exactly one selectable | [M] |
| FR-U12 | Step 4: Vegetables (optional) | §4.1, §9.6, §18 A-VEG | 4 | Multi-select shown; 0 selections valid; Next always enabled | [M] |
| FR-U13 | Order summary (server price) | §4.1, §6.5, §10.3 | 4 | Summary shows all items; price matches server-computed total | [A]+[M] |
| FR-U14 | Razorpay checkout | §4.1, §10.3 | 4 | Modal opens; Success click → verify-payment endpoint called | [M]+[E] |
| FR-U15 | Server-side payment verification | §4.1, §10.3, §13, §15.2 | 4 | Valid sig → `paymentStatus: 'paid'`; invalid sig → 400; duplicate → 200 (no re-decrement) | [A]+[E] |
| FR-U16 | Order status polling | §4.1, §6.6, §7.2 | 5 | Status updates within ≤ 10 s of admin change | [M] |
| FR-A01 | Separate admin login page | §4.2, §10.1, §6.7 | 6 | `/admin/login` not in customer nav | [M] |
| FR-A02 | Admin seeded, not registered | §4.2, §9.3, §11.2 | 6 | `seedAdmin.js` creates admin; no public admin register endpoint | [A] |
| FR-A03 | Inventory dashboard | §4.2, §10.4 | 6 | All items + stock counts at `/admin/inventory` | [M] |
| FR-A04 | Auto-decrement inventory (atomic) | §4.2, §10.3, §9.5, §7.3 | 4 | Each used item decremented by 1; empty vegetables → no veg decrement | [A] |
| FR-A05 | Manual stock update | §4.2, §10.4 | 6 | PATCH updates DB; negative stock rejected; UI reflects change | [A]+[M] |
| FR-A06 | Low-stock cron email | §4.2, §10.5, §17.3 | 7 | Below-threshold item → aggregated email in Mailtrap on next cron | [M]+[E] |
| FR-A07 | View all orders | §4.2, §10.4 | 6 | All orders at `/admin/orders` with customer + items populated | [M] |
| FR-A08 | Update order status | §4.2, §10.4 | 6 | PATCH persists new status in DB | [A] |
| FR-A09 | Real-time customer update | §4.2, §7.2, §20 | 5 | Customer page reflects admin status change within 5-10 s | [M] |

---

## 22. Optional Future Improvements

> **These are explicitly outside the required scope. Do not implement during the internship project.**

- Replace polling with **Socket.io** WebSockets for true real-time order updates.
- **Cross-origin deployment hardening (CSRF + SameSite=None):** Before deploying the frontend and backend to separate origins (e.g., `app.example.com` + `api.example.com`), switch the JWT cookie to `SameSite=None; Secure` and add CSRF token protection (Double-Submit Cookie pattern or a dedicated library). The demo's `SameSite=Strict` Vite-proxy setup does not carry over to cross-origin deployments unchanged. This step must be implemented and tested before any such deployment goes live.
- **Refresh token** mechanism to silently replace expiring access tokens.
- **Customer order history** page with pagination.
- **Live Razorpay** integration (post-KYC).
- **Map-based delivery tracking** (Google Maps or Mapbox).
- **Product images** served from Cloudinary or AWS S3.
- **Customer reviews and ratings**.
- **Discount codes / coupons** system.
- **Multi-pizza orders** (currently one pizza per order).
- Replace `console.error` with **Winston + file transport** for structured production logging.
- **CI/CD pipeline** (GitHub Actions: lint + test on push).
- **Docker Compose** for local development reproducibility.
- **MongoDB Atlas Search** for a pizza-search feature.

---

*End of project_plan.md — Revision 3*
*Status: APPROVED. CSRF clarification applied. `project_progress.md` created. Implementation proceeds phase by phase.*
