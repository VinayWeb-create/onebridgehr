# OneBridge Infotech HR Management System

A production-ready, enterprise-grade, role-based HR Management System built for **OneBridge Infotech Pvt. Ltd.** The application is secure, responsive, modular, and built on clean architectural principles.

---

## 🚀 Tech Stack

### Frontend
- **React.js** (Vite + TypeScript)
- **Tailwind CSS v4** (Modern utility styles)
- **TanStack Query** (React Query)
- **Axios** (With interceptors for JWT rotation)
- **Recharts** (Visual analytics)
- **Lucide React** (Icons)

### Backend
- **Node.js** & **Express.js** (TypeScript)
- **Prisma ORM**
- **MongoDB**
- **Socket.io** (Realtime toast alerts)
- **Nodemailer** (Transactional SMTP payslips)
- **PDFKit** (Automated PDF Payslips engine)
- **qrcode** (Dynamic employee validation codes)
- **bcrypt** & **jsonwebtoken** (Secure session authentication)

---

## 🏢 User Roles & Capabilities

| Feature / Action | Super Admin | HR | Team Lead | Employee |
| :--- | :---: | :---: | :---: | :---: |
| Onboard Companies & HR | Yes | No | No | No |
| Add & Edit Employee Profiles | Yes | Yes | No | No |
| Upload & Serve Legal Docs | Yes | Yes | No | Profile Only |
| Generate ID Cards & QR Codes | Yes | Yes | No | View Only |
| Manage Payroll & Payslips | Yes | Yes | No | View Only |
| Approve Leaves | Yes | Yes | Yes | Apply Only |
| Assign Tasks & Track Progress | Yes | Yes | Yes | Self Only |
| View System Wide Reports | Yes | Yes | No | Personal Only |
| Global Search Directories | Yes | Yes | Yes | Self Only |
| Transparent Digital Signatures | Yes (hr) | Yes (hr) | No | Profile Only |

---

## 📁 Repository Directory Map

- `/prisma/schema.prisma` - DB Models configuration for MongoDB.
- `/server` - Node/Express backend folder.
- `/client` - React + TypeScript frontend folder.
- `/docker` - Contains Dockerfiles for containerization.
- `/docker-compose.yml` - Orchestrates database, server, and client containers.

---

## ⚡ Setup & Run Locally

### Prerequisites
1. **Node.js** (v18+)
2. **MongoDB** instance running locally.

### Step 1: Database Link configuration
Create a `.env` in the workspace root with:
```env
DATABASE_URL="mongodb://localhost:27017/onebridge_hr?directConnection=true"
JWT_SECRET="onebridge_secret_key_123456_super_secure"
JWT_REFRESH_SECRET="onebridge_refresh_secret_key_7890_super_secure"
PORT=5000
NODE_ENV=development
EMAIL_HOST=smtp.ethereal.email
EMAIL_PORT=587
EMAIL_USER=dummy
EMAIL_PASS=dummy
FRONTEND_URL=http://localhost:5173
# Joining & Onboarding: 0 = create employee account + credentials immediately on "Mark Joined".
# Set to hours (e.g. 24) to auto-create the account the day after joining (one-day delay automation).
ONBOARDING_CREDENTIAL_DELAY_HOURS=0
```
*(A clone of this `.env` is automatically mapped into `/server` for script compatibility)*

### Step 2: Boot Backend
```bash
cd server
npm install
npm run prisma:generate
npm run prisma:db              # Sync database schema collections
npm run seed                   # Seed mock corporate profile records
npm run dev                    # Starts API server on port 5000
```

### Step 3: Boot Frontend
```bash
cd client
npm install
npm run dev                    # Starts dev web server on http://localhost:5173
```

---

## 🐳 Docker Deployment

To launch the complete infrastructure stack:
```bash
docker-compose up --build -d
```
- **Frontend Panel**: http://localhost:80
- **API Backend**: http://localhost:5000
- **MongoDB Instance**: localhost:27017

---

## 🔑 Seeding Credentials (Default Logins)

Seed data provides one account of each role. Use these to test the portal workflows:

| Role | Username (Email) | Password | Employee ID |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@onebridge.com` | `admin123` | OBI0001 |
| **HR Manager** | `hr@onebridge.com` | `hr12345` | OBI0002 |
| **Team Lead** | `lead@onebridge.com` | `lead123` | OBI0003 |
| **Software Engineer** | `employee@onebridge.com` | `emp1234` | OBI0004 |

---

## 📖 REST API Endpoint Documentation

### Authentication (`/api/auth`)
- `POST /login` - User Login (limits: account lockouts trigger after 5 invalid attempts for 15 mins).
- `POST /refresh` - Token rotation exchange.
- `POST /logout` - Terminates active session refresh keys.
- `GET /me` - Active user profile retrieval.
- `POST /change-password` - User credentials change.

### Employee Directory (`/api/employees`)
- `POST /` - Onboard employee [HR/Admin].
- `GET /` - List directories.
- `GET /:employeeId` - Retrieve detailed record.
- `PUT /:employeeId` - Update details.
- `POST /:employeeId/signature` - Upload digital signature (Enforces transparent PNG, max 2MB).
- `POST /:employeeId/profile-image` - Upload photo.
- `POST /:employeeId/document` - Upload document file.

### Attendance Console (`/api/attendance`)
- `POST /check-in` - Office / WFH check in with latitude/longitude coordinates check.
- `POST /check-out` - Check out calculation (Automatically computes standard vs overtime minutes).
- `POST /break/start` - Commences break session.
- `POST /break/end` - Resumes working session.
- `GET /today` - Check status of current date check-in.
- `GET /history` - List previous days log.

### Leave Tracker (`/api/leaves`)
- `POST /` - Submit leave request.
- `GET /history` - View leave balance cards & request history.
- `GET /pending` - View approval backlog [Leads/HR].
- `PATCH /:leaveId/review` - Approve or reject leave request.

### Kanban Tasks (`/api/tasks`)
- `POST /` - Assign task deliverable [Leads/HR].
- `PUT /:taskId` - Update progress %, comments, or checklist subtasks completion.
- `GET /my-tasks` - View assigned tasks list.

### Payroll Engine (`/api/payroll`)
- `POST /` - Generate payroll, compile professional PDF, and assign payslip number [HR/Admin].
- `GET /my-history` - View personal payslips.
- `POST /:payrollId/email` - Transactional SMTP mail out to staff [HR/Admin].

### Reports (`/api/reports`)
- `GET /hr` - Dynamic charts data for organization statistics.
- `GET /employee` - Stats dashboard counters for employees.
- `GET /search?query=...` - Global query search.
