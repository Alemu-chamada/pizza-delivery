# Dough & Co. Pizza Delivery Frontend — Antigravity Handoff

This document describes the frontend as it currently exists in the repository. It is intended for Google Antigravity to connect the finished UI to the existing backend without redesigning the interface.

## 1. Tech / Structure

### Runtime and libraries

- React `18.3.1`
- React DOM `18.3.1`
- Vite `8.0.5`
- React Router DOM `6.30.1`
- Tailwind CSS `3.4.17`
- Lucide React `0.468.0`
- JavaScript/JSX application code
- PostCSS and Autoprefixer
- Google Fonts:
  - DM Sans for body/interface text
  - Playfair Display for display headings

### Package scripts

Defined in `package.json`:

- `pnpm dev` — starts Vite
- `pnpm build` — creates the production build
- `pnpm preview` — previews the production build
- `pnpm format` — runs `oxfmt`

The Figma Make environment normally supervises the development server, so a second dev server should not be started inside that environment.

### Relevant folder structure

```text
.
├── index.html
├── package.json
├── pnpm-lock.yaml
├── postcss.config.js
├── tailwind.config.js
├── vite.config.ts
└── src
    ├── App.jsx
    ├── main.jsx
    ├── index.css
    ├── vite-env.d.ts
    └── data
        └── mockData.js
```

### Entry files

- `index.html` loads `/src/main.jsx`.
- `src/main.jsx` mounts React into `#root`, enables `React.StrictMode`, and wraps the app in `BrowserRouter`.
- `src/App.jsx` contains the route tree, page components, reusable UI components, mock auth state, and most page-level behavior.
- `src/index.css` contains Tailwind directives, font imports, global focus styles, overflow protection, and reduced-motion behavior.
- `src/data/mockData.js` contains the main replaceable pizza, order, inventory, and image demo datasets.

### Styling configuration

`tailwind.config.js` defines the central visual tokens:

- `cream` — warm page background
- `ink` — dark neutral text and dark surfaces
- `tomato` — primary red action/accent color
- `font-sans` — DM Sans
- `font-display` — Playfair Display
- `shadow-soft` — shared card shadow

Do not replace these tokens during integration. Existing responsive behavior is built with Tailwind breakpoints.

### Routing setup

Routing uses `BrowserRouter`, `Routes`, `Route`, `Link`, and `NavLink` from React Router v6.

`BrowserRouter` enables these compatibility flags:

- `v7_startTransition`
- `v7_relativeSplatPath`

The hosting environment must serve `index.html` for unknown application paths so direct navigation to client-side routes works.

---

## 2. Routes / Pages

### Public and authentication routes

| Route | Page/component | Intended access | Current behavior |
|---|---|---|---|
| `/` | `Home` | Public | Marketing homepage with builder CTAs. |
| `/register` | `Register` | Public | Local validation and simulated registration success. |
| `/login` | `Login` | Public | Local validation; creates a mocked customer session. |
| `/verify-email` | `VerifyEmail` | Public verification callback | Uses query/local state and a timer; no backend verification. |
| `/forgot-password` | `ForgotPassword` | Public | Local validation and privacy-safe simulated success. |
| `/reset-password` | `ResetPassword` | Public reset callback | Uses local state; `?expired=1` displays the expired state. |
| `/login-required` | `AccessState` | Public state page | Explains that authentication is required. |
| `/forbidden` | `AccessState` | Public state page | Displays “You don’t have permission.” |
| `/session-expired` | `AccessState` | Public state page | Prompts the user to log in again. |
| `*` | `NotFound` | Public | Branded 404 page with Home and Build Pizza actions. |

`/verify-email` recognizes:

- No `state` query: starts in `verifying`, then locally changes to success.
- `?state=success`: success.
- Any other non-empty state, such as `?state=invalid`: invalid/expired.

### Customer routes

| Route | Page/component | Intended access | Current behavior |
|---|---|---|---|
| `/dashboard` | `Dashboard` | Authenticated customer/admin | Displays a fixed demo welcome area and active order. It is not currently route-guarded. |
| `/account` | `Account` | Authenticated customer/admin | Reads the current `authUser`; shows `AccessState` if no user exists. |
| `/build` | `PizzaBuilder` | Customer/admin | Five-step local builder. It is currently publicly reachable. |
| `/checkout` | `Checkout` | Customer/admin with a draft pizza | Reads React Router location state; falls back to `defaultSelections`. |
| `/payment` | `Payment` / `PaymentResult` | Customer/admin after checkout | Query-driven UI states only; no Razorpay invocation. |
| `/orders` | `MyOrders` | Authenticated customer/admin | Renders `mockOrders`; not currently route-guarded. |
| `/orders/:id` | `OrderTracking` | Authenticated order owner/admin | Finds a mock order by ID; unknown IDs currently fall back to the first mock order. |

Builder state previews:

- `/build?view=loading`
- `/build?view=error`
- `/build?view=empty` or any non-empty unrecognized `view` value

Order screen previews:

- `/orders?view=loading`
- `/orders?view=empty`
- `/orders?view=unauthorized`
- `/orders?view=error`

The same `view` values also work on `/orders/:id`.

Payment states are selected using `state`:

- `/payment?state=creating`
- `/payment?state=opening`
- `/payment?state=processing`
- `/payment?state=verifying`
- `/payment?state=success`
- `/payment?state=failed`
- `/payment?state=cancelled`

### Admin routes

| Route | Page/component | Intended access | Current behavior |
|---|---|---|---|
| `/admin` | `AdminOverview` | Authenticated admin | Wrapped by the frontend-only `AdminAccess` role check. |
| `/admin/inventory` | `AdminInventory` | Authenticated admin | Wrapped by `AdminAccess`; updates only local state. |
| `/admin/orders` | `AdminOrders` | Authenticated admin | Wrapped by `AdminAccess`; status updates only local state. |

Admin state previews:

- `/admin/inventory?view=loading`
- `/admin/inventory?view=empty`
- `/admin/inventory?view=error`
- `/admin/orders?view=loading`
- `/admin/orders?view=empty`
- `/admin/orders?view=error`

Backend authorization must still protect all admin data/actions. The current role gate is presentation-only.

---

## 3. Important Components

All components below currently live in `src/App.jsx`.

### Shared UI primitives

- `Logo` — Dough & Co. brand lockup linked to Home.
- `Button` — primary, secondary, and ghost visual variants; supports loading and disabled states.
- `Input` — labeled input with optional icon and inline validation error.
- `Card` — shared rounded white surface with border and soft shadow.
- `Badge` — small tomato-accent eyebrow/status label.
- `Alert` — success/error feedback panel.
- `Loader` — spinner.
- `Skeleton` — animated skeleton block.
- `Toast` — fixed, accessible live-region success notification.
- `ConfirmDialog` — reusable modal confirmation shell used for logout.
- `StatusBadge` — data-driven semantic status pill with success, warning, info, danger, and neutral tones.

### Navigation and layout

- `Navbar`
  - Responsive desktop/mobile navigation.
  - Uses `NavLink` to indicate the active primary page.
  - Renders customer links for authenticated users.
  - Adds `Admin` only when `isAdmin` is true.
  - Contains the Account menu and logout confirmation.
- `Footer` — marketing footer and navigation.
- `AuthShell` — consistent authentication-page title/card layout.
- `AdminLayout` — admin hero, internal tabs, and content wrapper.

### Authentication and account

- `PasswordInput` — wraps `Input` with show/hide password behavior.
- `Register`
- `Login`
- `VerifyEmail`
- `ForgotPassword`
- `ResetPassword`
- `Account`
- `AccessState` — login-required, forbidden, and session-expired UI.
- `NotFound` — branded 404.

### Customer dashboard and pizza builder

- `Dashboard` — welcome hero, builder/order actions, active order, and promotional cards.
- `ActiveOrder` — accepts an order object or `null`; supports active and empty states.
- `PizzaBuilder` — owns the current builder step and selections.
- `PizzaOptionCard` — data-driven ingredient card supporting:
  - selected state
  - `aria-pressed`
  - single- or multi-select presentation
  - image, name, description, and price
  - unavailable/out-of-stock state
- `BuilderStatus` — loading/skeleton, network error/retry, and no-options states.
- `OrderSummary` — live compact or desktop summary of current selections and estimated price.
- `PizzaDetails` — selected ingredient details with optional price display.
- `getPizzaItems` — maps selected IDs to option objects.

### Checkout, payment, and orders

- `Checkout` — pizza details and separate payment summary.
- `Payment` — query-driven creating/opening/processing/verifying state screen.
- `PaymentResult` — success, failed, and cancelled result UI.
- `OrderCard` — responsive order-history card.
- `OrderStatusProgress` — reusable three-stage order tracker.
- `OrderScreenState` — loading, empty, unauthorized, and error/retry views.
- `MyOrders` — order history.
- `OrderTracking` — order details and tracking timeline.

### Admin

- `AdminAccess` — frontend-only role gate.
- `AdminOverview` — summary metrics, recent orders, and low-stock watchlist.
- `AdminState` — loading, empty, and error/retry admin states.
- `AdminInventory` — searchable/filterable inventory table and mobile cards.
- `StockUpdateModal` — validates and locally updates a stock quantity.
- `inventoryStatus` — derives Healthy, Low Stock, or Out of Stock from each item’s stock and threshold.
- `AdminOrders` — searchable/filterable order list with confirmation before local status advancement.

---

## 4. Authentication / RBAC UI

### Current mocked authentication model

`App` in `src/App.jsx` owns:

```js
const [authUser, setAuthUser] = useState({
  name: "Alex",
  email: "alex@example.com",
  role: "admin",
})
```

This means the preview initially starts as an authenticated admin.

The login form does not call a backend. After local validation and a timeout, it calls `onLogin` with:

```js
{ name: "Alex", email: form.email }
```

`App` then assigns `role: "customer"`.

Logout sets `authUser` to `null`. No JWT, localStorage, or sessionStorage is used.

### Admin visibility

`App` derives:

```js
const loggedIn = Boolean(authUser)
const isAdmin = authUser?.role === "admin"
```

`Navbar` receives both values.

For an authenticated admin, the normal customer navigation remains visible:

- Home
- Build Pizza
- My Orders
- Account menu
- Logout

The navbar additionally appends:

- Admin

For a customer (`role: "customer"`) or no user, the Admin item is not rendered.

There is no admin email comparison and no public admin registration.

### Required Antigravity replacement

Replace the `authUser` state with the backend’s authenticated user/session result, preferably loaded from an existing session endpoint backed by the backend’s httpOnly cookie.

The backend user shape should provide at minimum:

```text
name
email
role
```

The role check may continue to drive presentation, but backend authorization must enforce every admin route and action.

Customer routes such as Dashboard, Orders, Tracking, Checkout, and Payment are not currently protected by a route guard. Antigravity should add the real session-loading and redirect/unauthorized behavior.

---

## 5. Functional Mock / Demo / Static Data

Decorative marketing copy and general photography are not listed as backend data.

### `src/data/mockData.js`

#### Pizza options and pricing

`builderOptions` contains:

- Base options
- Sauce options
- Cheese options
- Vegetable options
- Ingredient IDs
- Names
- Descriptions
- Prices
- Image URLs
- Availability flags

Antigravity must replace this with backend-authoritative ingredient, availability, and pricing data.

#### Default pizza selections

`defaultSelections`:

```js
{
  base: "classic",
  sauce: "marinara",
  cheese: "mozzarella",
  vegetables: ["mushrooms", "peppers"]
}
```

This is used when Checkout is loaded without Router location state.

#### Customer orders

`mockOrders` contains:

- order ID
- date display string
- flattened pizza configuration string
- total
- payment status
- order status
- numeric tracking step

Antigravity must replace this with authenticated customer order-history and order-detail data.

#### Inventory

`initialInventory` contains:

- inventory ID
- ingredient
- category
- current stock
- item-specific low-stock threshold
- unit

Antigravity must replace this with backend inventory records.

#### Admin order rows

`adminOrdersSeed` combines `mockOrders` with demo customer names.

Antigravity must replace this with backend admin-order data including customer information.

### Functional mock data still inside `src/App.jsx`

#### Mock authenticated user

The initial `authUser` in `App` is a demo admin:

- name: Alex
- email: `alex@example.com`
- role: admin

The login flow creates a demo customer role.

#### Dashboard active order

`Dashboard` constructs a fixed `activeOrder` object using the first mock order ID plus static:

- status text
- description
- ETA
- tracking step

The greeting “Good evening, Alex” is also static.

Replace these with the authenticated customer and active-order response.

#### Admin overview statistics

`AdminOverview` hardcodes:

- Total Orders: `1,284`
- Paid Revenue: `$24,860`

Inventory item count and low-stock count are derived from `initialInventory`.

Replace all overview metrics with backend aggregates.

#### Payment state content and fallback result

`paymentStates` in `src/App.jsx` provides UI copy for:

- creating
- opening
- processing
- verifying

`Payment` falls back to total `16.5` if Router state is absent.

`PaymentResult` uses the first mock order ID as the success reference and displays fixed:

- payment status: Paid
- initial order status: Order Received

Replace these with the verified payment/order response.

#### Tracking stage mapping

`OrderStatusProgress`, `ActiveOrder`, and `AdminOrders` use exactly:

1. Order Received
2. In Kitchen
3. Sent to Delivery

The backend should return one of these supported order statuses or a stable enum that the frontend maps to these labels.

---

## 6. Pizza Builder

### Steps

`PizzaBuilder` uses this sequence:

1. Base
2. Sauce
3. Cheese
4. Vegetables
5. Summary

### Selection model

Local state:

```js
{
  base: null,
  sauce: null,
  cheese: null,
  vegetables: []
}
```

- Base: exactly one required selection.
- Sauce: exactly one required selection.
- Cheese: exactly one required selection.
- Vegetables: optional array; zero or multiple selections are allowed.
- Continue is disabled until the current required single-select step has a value.
- Vegetables can always continue with zero selections.
- Selections remain in component state when moving backward/forward within the mounted builder.
- The stepper only permits navigation to steps already reached.

### Availability

`PizzaOptionCard` remains visible when unavailable but:

- is disabled
- has reduced opacity
- displays “Out of Stock”
- cannot call `onSelect`

### Selection presentation

Selected options use:

- tomato border
- stronger shadow
- visible check icon
- `aria-pressed`

The Vegetables step also displays the number currently selected.

### Pricing

Prices are summed from the selected option objects.

`OrderSummary` shows:

- Base
- Sauce
- Cheese
- Vegetables
- Estimated price
- Backend-authority disclaimer

Desktop uses a sticky side summary. Mobile uses an expandable `<details>` summary.

### Transition to Checkout

On the Summary step, `PizzaBuilder` navigates to:

```js
navigate("/checkout", { state: { selections } })
```

This state is not durable. A hard refresh on Checkout loses the draft and uses `defaultSelections`.

Antigravity should replace local option data and decide whether builder draft state should live in a context/store, URL, backend cart, or another durable mechanism.

---

## 7. Orders / Payment

### Checkout / order summary

`Checkout` reads:

```js
location.state?.selections || defaultSelections
```

It maps selection IDs through `builderOptions`, calculates a local subtotal, shows free delivery, and displays a total.

The UI separates:

- Pizza details
- Payment summary

Actions:

- Edit pizza → `/build`
- Proceed to payment → `/payment?state=creating`

The Edit Pizza action currently starts a fresh builder instead of restoring the prior selections.

### Payment UI

There is no Razorpay SDK integration and no backend checkout creation.

`Payment` is entirely query-driven:

- `creating`
- `opening`
- `processing`
- `verifying`
- `success`
- `failed`
- `cancelled`

No automatic state transitions occur. Antigravity should drive these views from the real checkout/payment lifecycle.

Required backend/actions:

1. Revalidate price and stock.
2. Create the backend order/payment checkout.
3. Open Razorpay using backend-provided checkout data.
4. Process success/cancellation/failure callbacks.
5. Verify payment on the backend.
6. Return the canonical order reference, total, payment status, and initial order status.

Do not place Razorpay secrets in the frontend.

### My Orders

`MyOrders` maps `mockOrders` into `OrderCard`.

Each card displays:

- order reference
- date
- configuration
- total
- payment status
- order status
- Track Order action

Loading, empty, unauthorized, and error/retry states are available through the `view` query parameter.

### Tracking

`OrderTracking` reads `:id`, searches `mockOrders`, and currently falls back to the first order when no match exists.

It displays:

- order reference
- date
- payment status
- order status
- pizza configuration
- total
- `OrderStatusProgress`

Supported tracking stages are exactly:

```text
Order Received → In Kitchen → Sent to Delivery
```

Payment status and fulfillment/order status are presented separately.

Antigravity should replace the fallback behavior with a true not-found/unauthorized response and ensure customers can only access their own orders.

---

## 8. Admin

### Admin navigation

The main customer navbar is preserved for admins. `Admin` is appended only when `isAdmin` is true.

Inside the admin area, `AdminLayout` provides:

- Overview
- Inventory
- Orders

### Overview

`AdminOverview` displays:

- Total Orders
- Paid Revenue
- Inventory Items
- Low-Stock Items
- Recent Orders
- Low-Stock Watchlist

Low-stock watchlist entries are derived from each inventory item’s own threshold.

### Inventory

`AdminInventory` provides:

- Search by ingredient name
- Category filter:
  - All
  - Base
  - Sauce
  - Cheese
  - Vegetable
- Responsive desktop table
- Mobile inventory cards
- Update action

Columns/data:

- Ingredient
- Category
- Current Stock
- Low-Stock Threshold
- Unit
- Status

Status derivation:

- `stock === 0` → Out of Stock
- `stock <= threshold` → Low Stock
- otherwise → Healthy

`StockUpdateModal`:

- shows current quantity
- accepts a new numeric quantity
- rejects blank, non-numeric, or negative values
- displays loading state
- calls `onSave`
- closes and shows a success toast

The save currently mutates local React state after a timeout. It is not persisted.

### Admin Orders

`AdminOrders` provides:

- Search by customer or reference
- Order-status filter
- Customer
- Reference
- Date
- Pizza configuration
- Total
- Separate payment and order status badges
- Advance Status action

The only progression is:

```text
Order Received → In Kitchen → Sent to Delivery
```

At the final stage, the action is disabled.

Before advancing, a confirmation modal identifies the old and new status. The update currently mutates local state after a timeout and shows a success toast.

### Admin integration requirements

Antigravity must provide:

- backend-enforced admin authorization
- overview metrics
- recent order data
- inventory query
- inventory update action
- admin order query
- order status transition action
- server validation of allowed transitions
- server/network error mapping into the existing state components

---

## 9. State Management

There is no global state library and no React Context.

### Top-level state

`App` owns:

- `authUser`
- global toast message

It derives:

- `loggedIn`
- `isAdmin`

### Page-local state

Pages use React hooks:

- `useState`
- `useEffect`
- `useLocation`
- `useNavigate`
- `useParams`
- `useSearchParams`

Examples:

- Authentication forms own form values, errors, loading, and success state.
- `PizzaBuilder` owns step, max reached step, and selections.
- `AdminInventory` owns the locally mutable inventory list, search, category filter, edit target, and toast.
- `AdminOrders` owns the locally mutable order list, search, status filter, confirmation target, loading, and toast.
- `Navbar` owns mobile menu, account dropdown, and logout confirmation visibility.

### Data entry points

- Static/demo business data enters through imports from `src/data/mockData.js`.
- Builder card data is passed into `PizzaOptionCard`.
- Order data is passed into `OrderCard`, `ActiveOrder`, and `OrderStatusProgress`.
- Inventory data is mapped into desktop rows and mobile cards.
- Auth data is passed from `App` to `Navbar` and `Account`.

For backend integration, keep these component prop boundaries and replace the source data/actions.

---

## 10. Backend Integration Points

No API URLs are defined. The table below describes required data/actions without prescribing endpoints.

| Feature | Current file/component | Backend data/action expected |
|---|---|---|
| Session bootstrap | `src/App.jsx` → `App` | Load authenticated user from the httpOnly-cookie session; return name, email, and role. |
| Login | `Login` | Submit email/password, receive success/error through cookie-based auth, then refresh session user. |
| Logout | `App.logout`, `Navbar`, `Account` | Invalidate backend session, clear frontend user state, and redirect as appropriate. |
| Registration | `Register` | Create customer account and return validation/conflict errors. |
| Email verification | `VerifyEmail` | Verify backend token from URL/query and return verifying/success/invalid/expired. |
| Forgot password | `ForgotPassword` | Request reset email while preserving privacy-safe success messaging. |
| Reset password | `ResetPassword` | Validate reset token, update password, and return expired/used/validation states. |
| Authorization | `AdminAccess`, customer routes | Enforce customer/admin permissions server-side; map 401/403/session expiry to existing UI states. |
| Account | `Account` | Authenticated name, email, role/account type, and session state. |
| Dashboard | `Dashboard`, `ActiveOrder` | Authenticated customer name, current active order or `null`, ETA/status/configuration. |
| Ingredient catalog | `PizzaBuilder`, `PizzaOptionCard` | Category-grouped options with stable IDs, names, descriptions, images, prices, and availability. |
| Builder failures | `BuilderStatus` | Loading, empty, and network/server error states with retry action. |
| Price calculation | `OrderSummary`, `Checkout` | Backend-authoritative line prices, total, delivery amount, and stock revalidation. |
| Draft/cart | `PizzaBuilder`, `Checkout` | Optional durable draft/cart if reload and Edit Pizza must preserve selections. |
| Checkout creation | `Checkout` | Submit selected ingredient IDs and receive canonical priced order/payment checkout data. |
| Razorpay | `Payment` | Backend-created Razorpay checkout data; frontend opens payment UI without exposing secrets. |
| Payment verification | `PaymentResult` | Verified payment result, canonical order reference, total, payment status, and order status. |
| Customer order history | `MyOrders`, `OrderCard` | Authenticated paginated/list order data. |
| Order detail/tracking | `OrderTracking`, `OrderStatusProgress` | Authorized order details and one of the three supported statuses. |
| Admin overview | `AdminOverview` | Total orders, paid revenue, inventory item count, low-stock count, recent orders, watchlist. |
| Inventory list | `AdminInventory` | Ingredient/category/stock/threshold/unit records. |
| Inventory update | `StockUpdateModal` | Validate and persist non-negative quantity; return updated item and errors. |
| Admin order list | `AdminOrders` | Customer, reference, configuration, total, payment status, order status, date. |
| Order status update | `AdminOrders` | Persist only the allowed next transition and return the updated order. |
| Toast/error mapping | `Toast`, `Alert`, state components | Convert backend successes/errors into existing feedback components. |

---

## 11. Gaps / TODO

### Authentication and permissions

- The app starts with a mocked admin user.
- Login always creates a mocked customer user after a timeout.
- No real session bootstrap, login, logout, registration, verification, or password reset exists.
- Only admin routes have a frontend role check.
- Dashboard, builder, checkout, payment, order history, and tracking are not route-guarded.
- Frontend role checks are not security and must not replace backend authorization.
- Account displays “Secure cookie session” as intended final behavior, but the current preview has no backend cookie session.

### Builder and checkout

- Builder state is local and is lost on unmount/reload.
- Checkout receives selections only through Router location state.
- Checkout falls back to `defaultSelections` on direct load or refresh.
- Edit Pizza starts a new builder instead of restoring the checkout draft.
- Pricing is calculated from mock frontend values.
- Availability is read from mock frontend flags.
- No delivery address/customer details UI is present.

### Payment

- No Razorpay SDK integration.
- No backend checkout creation.
- No automatic payment-state transitions.
- Payment states are selected by query string.
- Result data is mocked/fallback data.
- Retry returns to a UI state but performs no payment action.

### Orders

- Order history is static.
- Tracking is static.
- Unknown tracking IDs incorrectly fall back to the first mock order.
- No ownership enforcement.
- No polling, subscription, or refresh behavior.
- Order dates are preformatted strings rather than backend timestamps.
- Pizza configuration is a flattened display string rather than structured order-line data.

### Admin

- Overview revenue/order totals are hardcoded.
- Inventory updates are local and reset on reload.
- Order status updates are local and reset on reload.
- Loading is simulated with `setTimeout`.
- Search/filtering is client-side over the current local arrays.
- Admin state previews are controlled through query strings.
- Server-side validation, concurrency, and stale-data handling are not implemented.

### General

- Most components and pages are currently consolidated in `src/App.jsx`. They are reusable at the function/prop level, but Antigravity may split them into feature folders during integration while preserving behavior and styling.
- Several simulated UI actions use `setTimeout`; these should be replaced with real async actions.
- The default preview auth state is intentionally an admin so admin screens are visible; production must derive this from the session.
- Decorative image URLs use Unsplash and require network access.
- No automated test suite is present.
- No analytics, telemetry, or error-reporting integration is present.

---

## 12. Design Preservation

Antigravity should preserve the following during integration:

### Brand and tokens

- Dough & Co. logo treatment
- Warm cream background
- Dark ink surfaces/text
- Tomato red primary accent
- Green/amber/red semantic statuses
- DM Sans body typography
- Playfair Display headings

### Shared visual language

- Large rounded cards and panels
- Soft borders and `shadow-soft`
- Pill-shaped primary/secondary buttons
- Tomato focus rings
- Rounded form fields
- Lucide icon usage
- Badge and status-pill styling
- Restrained hover elevation and pressed states
- Reduced-motion support

### Responsive patterns

- Mobile menu below the `xl` breakpoint
- Builder desktop sticky summary
- Builder mobile expandable summary
- Responsive order cards
- Inventory desktop table plus mobile cards
- Admin tab navigation with horizontal overflow on narrow screens
- Stacked mobile CTAs and multi-column desktop layouts

### Key layouts

- Marketing Home hero and benefits sections
- Authentication card shell
- Customer dashboard dark hero
- Five-step Pizza Builder
- Checkout split between pizza details and payment summary
- Payment result cards
- Three-stage tracking timeline
- Admin dark header and internal Overview/Inventory/Orders tabs

Do not replace the customer navbar with an admin-only navbar. Admins retain all customer navigation and receive one additional Admin item.

---

# ANTIGRAVITY HANDOFF CHECKLIST

- [ ] Install dependencies with the existing pnpm lockfile.
- [ ] Keep React 18, React Router v6, Vite, and Tailwind 3 compatibility.
- [ ] Configure SPA history fallback for direct route loading.
- [ ] Replace the mocked initial `authUser` with backend session bootstrap.
- [ ] Connect login, logout, registration, email verification, forgot-password, and reset-password actions.
- [ ] Use the backend’s httpOnly-cookie authentication; do not store JWTs in localStorage or sessionStorage.
- [ ] Return authenticated user `name`, `email`, and `role`.
- [ ] Keep Admin hidden unless the authenticated role is admin.
- [ ] Enforce all permissions and order ownership on the backend.
- [ ] Add real customer-route protection and session-expired handling.
- [ ] Replace `builderOptions` with backend ingredient, pricing, image, and availability data.
- [ ] Preserve single-select Base/Sauce/Cheese and optional multi-select Vegetables behavior.
- [ ] Add durable pizza draft/cart behavior if reload and Edit Pizza must preserve selections.
- [ ] Revalidate price and stock on the backend before payment.
- [ ] Connect backend checkout creation and Razorpay using backend-provided data only.
- [ ] Replace query-driven payment simulation with the real payment lifecycle.
- [ ] Populate payment results from the verified backend response.
- [ ] Replace `mockOrders` with authenticated order history and detail queries.
- [ ] Remove the unknown-order fallback and return not-found/forbidden correctly.
- [ ] Keep tracking stages exactly: Order Received → In Kitchen → Sent to Delivery.
- [ ] Replace admin overview metrics and recent-order/watchlist data.
- [ ] Replace inventory list and local stock mutation with backend operations.
- [ ] Replace local admin order progression with a validated backend transition.
- [ ] Preserve item-specific low-stock thresholds.
- [ ] Map backend loading, empty, validation, network, unauthorized, forbidden, success, and retry states into the existing components.
- [ ] Preserve the design tokens, typography, navbar behavior, responsive layouts, cards, buttons, badges, and status styling.
- [ ] Consider splitting `src/App.jsx` by feature without changing rendered behavior.
- [ ] Add integration and route tests after backend wiring.
- [ ] Run `pnpm build` before delivery.
