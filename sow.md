

# 📄 Statement of Work / Coding Prompt

## Project: **REUNITE – Missing Person Recovery Platform**

### Objective

Build an MVP platform named **REUNITE** using the **MERN stack (MongoDB, Express, React, Node.js)** with **TypeScript everywhere**, enabling citizens to report missing persons and police to investigate cases using AI-assisted face matching, while keeping humans fully in control of final decisions.

---

## 🔒 Core Principles

* **Human-in-the-loop**: AI assists, police decides.
* **Role-based access control**: Citizen vs Police.
* **State-driven workflow**: Requests move through clearly defined states.
* **MVP-first**: Keep it simple, extensible later.
* **TypeScript only** (frontend + backend).

---

## 🧩 Tech Stack (Strict)

* **Frontend**: React + TypeScript (Vite or CRA)
* **Backend**: Node.js + Express + TypeScript
* **Database**: MongoDB + Mongoose
* **Auth**: Simple role-based auth (mock or JWT)
* **AI Service**: Existing face scan API (assume it exists, call it as a service)
* **No JavaScript anywhere**

---

## 👥 User Roles

### 1. Citizen (Normal User)

* Can report a missing person
* Can view status of their own requests
* Cannot see scan results or police notes

### 2. Police User

* Can view all requests
* Can discard invalid requests
* Can move request to investigation
* Can trigger face scan
* Can view scan results (image + score)
* Can mark request as FOUND or DECLINED
* Must add investigation notes

---

## 🔁 Request State Machine (Mandatory)

Requests must strictly follow this state flow:

```
REPORTED → UNDER_REVIEW → SCANNING → FOUND | DECLINED
```

Optional terminal state:

```
REPORTED → DISCARDED
```

⚠️ State transitions must only be allowed by Police users.

---

## 🗄️ Backend Architecture (Express + TypeScript)

### Models (Mongoose + TypeScript interfaces)

#### User Model

```ts
- _id
- name
- email
- role: "CITIZEN" | "POLICE"
- createdAt
```

#### MissingPersonRequest Model

```ts
- _id
- reporterId (User)
- name
- gender
- dateOfBirth
- bloodGroup
- lastKnownLocation: {
    latitude: number,
    longitude: number
  }
- photoUrl
- status: "REPORTED" | "UNDER_REVIEW" | "SCANNING" | "FOUND" | "DECLINED" | "DISCARDED"
- createdAt
- updatedAt
```

#### ScanResult Model

```ts
- _id
- requestId
- cctvId
- bestMatchImageUrl
- confidenceScore
- createdAt
```

#### PoliceNote Model

```ts
- _id
- requestId
- policeUserId
- note
- createdAt
```

---

## 🎮 Controllers (TypeScript)

### CitizenController

* `createMissingPersonRequest`
* `getMyRequests`

### PoliceController

* `getAllRequests`
* `updateRequestStatus`
* `discardRequest`
* `addPoliceNote`
* `triggerFaceScan`
* `getScanResults`

### ScanController

* Calls existing face recognition API
* Saves scan results
* Does NOT auto-update request status

---

## 🛣️ Routes

### Citizen Routes

```
POST   /api/requests
GET    /api/requests/me
```

### Police Routes

```
GET    /api/police/requests
PATCH  /api/police/requests/:id/status
POST   /api/police/requests/:id/scan
POST   /api/police/requests/:id/note
GET    /api/police/requests/:id/scans
```

---

## 🧠 Face Scan Logic (Important)

* Scan can only be triggered when status = `UNDER_REVIEW`
* Scan returns:

  * best match image
  * confidence score
* Scan result **does not auto-resolve** the request
* Police must manually mark FOUND or DECLINED after visual verification

---

## 🖥️ Frontend (React + TypeScript)

### Citizen UI

* Missing person submission form
* List of submitted requests
* Status badges only (no scan data)

### Police Dashboard

* Requests table (filter by status)
* Request detail view
* Buttons:

  * Move to UNDER_REVIEW
  * Run Scan
  * Mark FOUND / DECLINED
* Scan result panel (image + score)
* Notes section (mandatory on resolution)

---

## 📍 Location Handling

* Use browser geolocation API
* Latitude + longitude only
* No address resolution needed for MVP

---

## 🚦 Validation Rules

* Cannot scan unless status = UNDER_REVIEW
* Cannot resolve without adding police note
* Citizens cannot edit requests after submission
* Police cannot delete requests (only discard)

---

## 🧪 Error & Edge Case Handling

* No face detected in uploaded image
* Low-confidence scan results
* Multiple possible matches
* Invalid or spam reports
* All failures must show clear UI messages

---

## 🧼 Code Quality Rules

* Strict TypeScript
* Typed request/response DTOs
* Proper folder separation:

```
controllers/
models/
routes/
services/
middlewares/
```

* Clean, readable, extensible code
* No hardcoded logic in routes

---

## 🚀 Deliverable

A fully working **MVP REUNITE platform** with:

* Citizen reporting flow
* Police investigation dashboard
* AI-assisted scanning
* Manual verification
* Clean architecture ready for future scaling

---

### Final Instruction to Cursor

> Build this system end-to-end following the above specification exactly.
> Prioritize correctness, clarity, and MVP completeness over advanced features.

---
