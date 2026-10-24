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

## 🔑 Production Team Credentials & Access Directory

The table below lists all provisioned user accounts and credentials across all organizational tiers (Administration, Engineering, and Marketing). These accounts are used for the OneBridge HRMS portal and for synchronizing user profiles, roles, and meeting permissions to the OneBridge Microsoft Teams App.

| Role | Name | Username (Email) | Password | Employee ID | Department | Designation | Account Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Uday Kumar C | `hr@onebridgeinfotech.com` | `admin123` | OBI0001 | Administration | Founder & Managing Director | Active |
| **Super Admin** | Mohammed Irfan | `mohammed.irfan@onebridgeinfotech.com` | `admin123` | OBI1117 | Administration | Associate Director | Active |
| **Team Lead** | Sri Venkata Ganga Vinay Avala | `vinay@onebridgeinfotech.com` | `080505` | OBI0006 | Engineering | Full Stack Developer | Active |
| **Employee** | Sandeep Kumar Bodapudi | `sandeep@onebridgeinfotech.com` | `010703` *(init)* / Portal set | OBI0007 | Engineering | Full Stack Developer | Active |
| **Employee** | Swathi Garigipati | `swathi@onebridgeinfotech.com` | `260889` | OBI0008 | Marketing | Digital & Cloud Marketing Specialist | Active |
| **Employee** | Dheeraj Bollapally | `Dheeraj2026@gmail.com` | `010195` *(init)* / Portal set | OBI0009 | Marketing | Marketing Cloud Consultant | Active |
| **Team Lead** | Reddy ARK Akhil | `reddyakhil2718@gmail.com` | `180496` | OBI0010 | Marketing | Digital Marketing Specialist | Active |
| **Employee** | Galla Vinay | `vinaygalla121@gmail.com` | `240405` | OBI0011 | Marketing | Performance Marketing Specialist | Active |
| **Employee** | Venata Bhuvan Lolla | `bhuvan@onebridgeinfotech.com` | `170603` | OBI0012 | Engineering | Full Stack Developer | Active |

> **Note on Password Convention:** Under OneBridge HRMS onboarding automation, default initial passwords are dynamically generated from the employee's Date of Birth in `DDMMYY` format (e.g. DOB `08-05-2005` &rarr; `080505`). If an employee subsequently updates their password via `/api/auth/change-password`, their updated custom password applies.

---

## 👥 OneBridge Team Data Directory for Teams Database Push

This section contains complete, structured profile information, skills, employee tags, contact records, and administrative metadata required to seed and synchronize the OneBridge Teams Application database.

### 1. Executive & Administrative Members

#### **Uday Kumar C**
- **Employee ID:** `OBI0001`
- **System Role:** `SUPER_ADMIN`
- **Department:** `Administration` (Management)
- **Designation:** `Founder & Managing Director`
- **Official Email:** `hr@onebridgeinfotech.com`
- **Phone:** `9398355196`
- **Blood Group:** `O+`
- **Account Validity:** `2031-08-10`
- **Office Location ID:** `6ac77fcc833da191589d5d19` (OneBridge Hyderabad HQ, KPHB)
- **Headquarters Address:** Sathyabama Complex, Bhagya Nagar Colony, KPHB, Hyderabad, Telangana 500072
- **Government IDs:**
  - PAN: `ABCDE1234F`
  - Aadhaar: `123456789012`
- **Date of Joining:** `2020-01-01`
- **Custom Digital Card URL:** [https://onebridgeinfotech.com/card/uday-kumar-c](https://onebridgeinfotech.com/card/uday-kumar-c)
- **Employee Tags & Capabilities:**
  `["ADMIN", "MANAGEMENT", "DIRECTOR", "SYSTEM SECURITY", "DATABASE MANAGEMENT", "USER ROLES & PERMISSIONS", "EXECUTIVE"]`
- **Assets Configured:** Profile Photo (`Yes`), Digital Signature (`Yes`), Dynamic QR (`Yes`)

#### **Mohammed Irfan**
- **Employee ID:** `OBI1117`
- **System Role:** `SUPER_ADMIN`
- **Department:** `Administration` (Management)
- **Designation:** `Associate Director`
- **Official Email:** `mohammed.irfan@onebridgeinfotech.com`
- **Phone:** `9059976562` / `9876543211`
- **Blood Group:** `A+`
- **Account Validity:** `2031-08-10`
- **Address:** GoLive Plaza, Hitech City, Hyderabad, Telangana 500081
- **Government IDs:**
  - PAN: `FGHIJ5678K`
  - Aadhaar: `234567890123`
- **Date of Joining:** `2021-06-15`
- **Employee Tags & Capabilities:**
  `["ADMIN", "MANAGEMENT", "ASSOCIATE DIRECTOR", "SYSTEM SECURITY", "DATABASE MANAGEMENT", "USER ROLES & PERMISSIONS"]`
- **Assets Configured:** Digital Signature (`Yes`), Dynamic QR (`Yes`)

---

### 2. Technical & Engineering Team (Software Engineering & Developers)

#### **Sri Venkata Ganga Vinay Avala**
- **Employee ID:** `OBI0006`
- **System Role:** `TEAM_LEAD`
- **Department:** `Engineering`
- **Designation:** `Full Stack Developer`
- **Official Email:** `vinay@onebridgeinfotech.com`
- **Phone:** `6302413904`
- **Blood Group:** `A+`
- **Date of Birth:** `2005-05-08` (Gender: Male)
- **Date of Joining:** `2026-07-20`
- **Account Validity:** `2027-08-13`
- **Office Location ID:** `6ac77fcc833da191589d5d19`
- **Current Address:** 3-77
- **Permanent Address:** S.Agraharam, Rowthulapudi Mandal
- **Government IDs:**
  - PAN: `CTPNV2273A`
  - Aadhaar: `981435007400`
- **Emergency Contact:** Avala Naga Satya Kumari (Relationship: Family, Phone: `7095003082`)
- **Compensation & Salary:** Basic ₹6,000 / month
- **Custom Digital Card URL:** [https://onebridgeinfotech.com/card/vinay-a](https://onebridgeinfotech.com/card/vinay-a)
- **Employee Tags & Skills:**
  `["TEAM_LEAD", "FULL_STACK_DEVELOPER", "ENGINEERING", "REACT", "NODE_JS", "TYPESCRIPT", "PRISMA", "MONGODB", "API_INTEGRATION"]`
- **Assets Configured:** Profile Photo (`Yes`), Dynamic QR (`Yes`)

#### **Sandeep Kumar Bodapudi**
- **Employee ID:** `OBI0007`
- **System Role:** `EMPLOYEE`
- **Department:** `Engineering`
- **Designation:** `Full Stack Developer`
- **Official Email:** `sandeep@onebridgeinfotech.com`
- **Phone:** `7075196267`
- **Blood Group:** `O+`
- **Date of Birth:** `2003-07-01` (Gender: Male)
- **Date of Joining:** `2026-09-12`
- **Account Validity:** `2027-08-13`
- **Office Location ID:** `6ac77fcc833da191589d5d19`
- **Address:** 6-182, Vivekananda Colony, Prathipadu, Andhra Pradesh
- **Government IDs:**
  - PAN: `HPZPB6878G`
  - Aadhaar: `740917842830`
- **Emergency Contact:** Family (Phone: `9553300573`)
- **Employee Tags & Skills:**
  `["ENGINEERING", "FULL_STACK_DEVELOPER", "FRONTEND", "BACKEND", "JAVASCRIPT", "TYPESCRIPT", "WEB_SERVICES"]`
- **Assets Configured:** Profile Photo (`Yes`), Dynamic QR (`Yes`)

#### **Venata Bhuvan Lolla**
- **Employee ID:** `OBI0012`
- **System Role:** `EMPLOYEE`
- **Department:** `Engineering`
- **Designation:** `Full Stack Developer`
- **Official Email:** `bhuvan@onebridgeinfotech.com`
- **Phone:** `918309600721`
- **Blood Group:** `O+`
- **Date of Birth:** `2003-06-17` (Gender: Male)
- **Date of Joining:** `2026-09-30`
- **Account Validity:** `2027-10-01`
- **Office Location ID:** `6ac77fcc833da191589d5d19`
- **Address:** Vijayawada, Andhra Pradesh
- **Government IDs:**
  - PAN: `GYWPB1313P`
  - Aadhaar: `880108963517`
- **Employee Tags & Skills:**
  `["ENGINEERING", "SOFTWARE_ENGINEERING", "FULL_STACK_DEVELOPER", "WEB_DEVELOPMENT", "DATABASE", "API"]`
- **Assets Configured:** Dynamic QR (`Yes`)

---

### 3. Growth & Digital Marketing Team

#### **Reddy ARK Akhil**
- **Employee ID:** `OBI0010`
- **System Role:** `TEAM_LEAD`
- **Department:** `Marketing`
- **Designation:** `Digital Marketing Specialist`
- **Official Email:** `reddyakhil2718@gmail.com`
- **Phone:** `+91 79894 06818`
- **Blood Group:** `O+`
- **Date of Birth:** `1996-04-18` (Gender: Male)
- **Date of Joining:** `2026-08-29`
- **Account Validity:** `2027-08-29`
- **Office Location ID:** `6ac77fcc833da191589d5d19`
- **Current Address:** 7-10, Sri Krishna Colony, Peerzadiguda Boduppal - 500039
- **Permanent Address:** 3-6-36/37, Srinivasa Hall Backside 3rd Line, Narasaraopet, Guntur District - 500035
- **Government IDs:**
  - PAN: `CFZPR9151K`
  - Aadhaar: `852698796591`
- **Emergency Contact:** Family (Phone: `+91 79894 06818`)
- **Custom Digital Card URL:** [https://onebridgeinfotech.com/card/akhil-r](https://onebridgeinfotech.com/card/akhil-r)
- **Employee Tags & Skills:**
  `["TEAM_LEAD", "MARKETING", "DIGITAL_MARKETING", "STRATEGY", "SEO", "SEM", "CAMPAIGN_MANAGEMENT", "GROWTH"]`
- **Assets Configured:** Dynamic QR (`Yes`)

#### **Swathi Garigipati**
- **Employee ID:** `OBI0008`
- **System Role:** `EMPLOYEE`
- **Department:** `Marketing`
- **Designation:** `Digital and cloud Marketing Specialist`
- **Official Email:** `swathi@onebridgeinfotech.com`
- **Phone:** `9959760028`
- **Blood Group:** `B+ve`
- **Date of Birth:** `1989-08-26`
- **Date of Joining:** `2026-08-03`
- **Account Validity:** `2027-08-13`
- **Office Location ID:** `6ac77fcc833da191589d5d19`
- **Compensation & Salary Structure:**
  - Basic: ₹50,000 | HRA: ₹20,000 | DA: ₹7,500 | Allowance: ₹6,000 | Bonus: ₹2,000
  - Deductions: PF ₹6,000 | Professional Tax ₹200 | Income Tax ₹3,500
  - Gross Monthly Salary: ₹85,500
- **Custom Digital Card URL:** [https://onebridgeinfotech.com/card/swathi-sri-prabha-garigipati](https://onebridgeinfotech.com/card/swathi-sri-prabha-garigipati)
- **Employee Tags & Skills:**
  `["MARKETING", "CLOUD_MARKETING", "DIGITAL_MARKETING", "CONTENT_STRATEGY", "SOCIAL_MEDIA", "LEAD_GENERATION"]`
- **Assets Configured:** Dynamic QR (`Yes`)

#### **Dheeraj Bollapally**
- **Employee ID:** `OBI0009`
- **System Role:** `EMPLOYEE`
- **Department:** `Marketing`
- **Designation:** `Marketing Cloud Consultant`
- **Official Email:** `Dheeraj2026@gmail.com`
- **Phone:** `+1 (937) 815-9879`
- **Blood Group:** `O+`
- **Date of Birth:** `1995-01-01` (Gender: Male)
- **Date of Joining:** `2026-08-13`
- **Account Validity:** `2027-08-13`
- **Office Location ID:** `6ac77fcc833da191589d5d19`
- **Address:** Shanti Nagar
- **Government IDs:**
  - PAN: `abcdedff`
  - Aadhaar: `283824647737`
- **Employee Tags & Skills:**
  `["MARKETING", "MARKETING_CLOUD", "SALESFORCE", "CRM_AUTOMATION", "EMAIL_CAMPAIGNS", "CONSULTING"]`
- **Assets Configured:** Dynamic QR (`Yes`)

#### **Galla Vinay**
- **Employee ID:** `OBI0011`
- **System Role:** `EMPLOYEE`
- **Department:** `Marketing`
- **Designation:** `Performance Marketing Specialist`
- **Official Email:** `vinaygalla121@gmail.com`
- **Phone:** `9182306109`
- **Blood Group:** `O+`
- **Date of Birth:** `2005-04-24` (Gender: Male)
- **Date of Joining:** `2026-08-24`
- **Account Validity:** `2027-09-01`
- **Office Location ID:** `6ac77fcc833da191589d5d19`
- **Address:** Prathipadu Mandal, Dharmavaram, Andhra Pradesh
- **Government IDs:**
  - PAN: `CYBPV1624G`
  - Aadhaar: `4915 2302 6268`
- **Employee Tags & Skills:**
  `["MARKETING", "PERFORMANCE_MARKETING", "PAID_ADS", "ANALYTICS", "ROI_OPTIMIZATION", "META_ADS", "GOOGLE_ADS"]`
- **Assets Configured:** Profile Photo (`Yes`), Dynamic QR (`Yes`)

---

## 🛰️ Teams App Database Sync Architecture & Integration Config

Use the following parameters and structure when synchronizing OneBridge team members to your external Teams Meeting App database:

### Core Database & Infrastructure Endpoints
- **MongoDB Atlas Cluster (Primary Data Store):**
  ```env
  DATABASE_URL="mongodb://avalavinay8_db_user:d90o4a1kTZHW0zXK@ac-kubyatb-shard-00-00.3dgdwe3.mongodb.net:27017,ac-kubyatb-shard-00-01.3dgdwe3.mongodb.net:27017,ac-kubyatb-shard-00-02.3dgdwe3.mongodb.net:27017/onebridge_hr?ssl=true&replicaSet=atlas-lqo1ss-shard-0&authSource=admin&appName=Cluster0"
  ```
- **PostgreSQL Vector DB (Neon Tech / AI Biometrics):**
  ```env
  POSTGRES_URL="postgresql://neondb_owner:npg_YmLBdCqf1QS7@ep-curly-voice-a54f2nr8-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
  ```
- **Production API Server:** `https://onebridgehr.onrender.com`
- **Production HRMS Web Panel:** `https://hrms.onebridgeinfotech.com`
- **AI Face Verification Service:** `https://onebridgehr-487l.onrender.com`
- **HQ Geolocation Coordinates:**
  - Latitude: `17.4944497`
  - Longitude: `78.4031731`
  - Geofence Boundary: `250 meters` (Sathyabama Complex, KPHB Colony, Hyderabad)

### Sample Teams User Payload Schema
```json
{
  "teamsUserId": "OBI0006",
  "employeeId": "OBI0006",
  "name": "Sri Venkata Ganga Vinay Avala",
  "email": "vinay@onebridgeinfotech.com",
  "phone": "6302413904",
  "department": "Engineering",
  "designation": "Full Stack Developer",
  "role": "TEAM_LEAD",
  "isMeetingHost": true,
  "canScheduleMeetings": true,
  "tags": [
    "TEAM_LEAD",
    "FULL_STACK_DEVELOPER",
    "ENGINEERING",
    "REACT",
    "NODE_JS",
    "TYPESCRIPT",
    "MONGODB"
  ],
  "officeLocation": {
    "name": "OneBridge Infotech Hyderabad HQ",
    "latitude": 17.4944497,
    "longitude": 78.4031731
  },
  "status": "ACTIVE"
}
```

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
