# Standalone Smart Attendance & Biometric Tracking Module

This package is an extracted, standalone version of the **Enterprise Smart Attendance & Biometric Tracking System** from the HRMS codebase. It is designed to be easily dropped into any new or existing Node.js / React client project.

---

## Architecture Highlights

1. **Client-Side Biometric Computer Vision (Zero heavy external ML bundle)**:
   - Built with pure TypeScript using HTML5 Canvas 2D API (`faceBiometrics.ts`).
   - Anti-spoofing liveness detection (blink detection, micro-movement, static photo detection, screen detection).
   - Facial landmark alignment and 128-dimensional morphometric vector extraction.
   - Encrypted with AES-256-GCM before persistent database storage.
2. **Resilient Geofencing & GPS**:
   - Geolocation helper (`geolocation.ts`) uses high-accuracy GPS with an automatic fallback to Wi-Fi/cellular triangulation for indoor/basement check-ins.
   - Server-side Haversine distance verification against geofenced office coordinates.
3. **Hardware Device Authorization**:
   - Device fingerprinting (`deviceFingerprint.ts`) limits clock-ins to authorized registered devices (e.g. max 2 devices per employee) to stop buddy punching.
4. **Administrative Policies & Dashboards**:
   - Multi-office management (name, branch, coordinates, radius).
   - Attendance policies (grace time, late thresholds, half-day/full-day hours).
   - Monthly Attendance Matrix & Verification audit trail.
   - Manual/Fallback methods: Daily PIN codes, QR codes, direct check-outs.

---

## Directory Structure

```text
attendance-module/
├── README.md                                  <-- This integration guide
├── schema/
│   └── attendance.prisma                      <-- Prisma DB schema models
├── server/
│   ├── controllers/
│   │   ├── attendanceController.ts            <-- Legacy/Standard check-in, codes, breaks, reports
│   │   └── smartAttendanceController.ts       <-- Biometric verification, enrollment, policies, offices
│   ├── routes/
│   │   └── attendanceRoutes.ts                <-- Express router mounting all attendance endpoints
│   └── services/
│       ├── biometricService.ts                <-- AES-256 encryption, cosine similarity, geofence math
│       └── qrService.ts                       <-- QR code generation utility
└── client/
    ├── utils/
    │   ├── faceBiometrics.ts                  <-- Pure TS facial recognition & liveness engine
    │   ├── deviceFingerprint.ts               <-- Device hashing & browser info
    │   └── geolocation.ts                     <-- Resilient GPS with timeout and indoor fallback
    ├── components/
    │   ├── SmartBiometricModal.tsx            <-- Live biometric camera modal for check-in/out
    │   ├── BiometricFaceScannerHUD.tsx        <-- Futuristic HUD overlay for face scanner
    │   ├── MonthlyAttendanceMatrix.tsx        <-- Monthly attendance calendar view
    │   └── AdminEmployeeAttendanceCatalog.tsx <-- Admin employee attendance review table
    └── pages/
        ├── Attendance.tsx                     <-- Main attendance dashboard (employee & admin views)
        ├── AttendanceEnrollment.tsx           <-- One-time face registration & device pairing
        └── AttendanceSetup.tsx                <-- Admin office location & policy management
```

---

## Integration Steps

### Step 1: Database Setup

1. Copy the models from `schema/attendance.prisma` into your project's `prisma/schema.prisma`.
2. Connect `employeeId` to your project's `User` or `Employee` model:
   ```prisma
   // In your User / Employee model:
   attendance           Attendance[]
   attendanceEnrollment AttendanceEnrollment?
   registeredDevices    RegisteredDevice[]
   ```
3. Run migration or push schema:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

*(If your client project uses MongoDB with Mongoose or PostgreSQL with TypeORM/Sequelize/Drizzle, map the fields in `schema/attendance.prisma` to your ORM schemas).*

---

### Step 2: Server Setup

1. Copy `server/controllers`, `server/routes`, and `server/services` into your backend `src/` folder.
2. In `server/routes/attendanceRoutes.ts`:
   - Replace `import { protect, restrictTo } from '../middleware/auth'` with your project's auth middleware.
3. In `server/controllers/smartAttendanceController.ts` and `attendanceController.ts`:
   - Ensure the import of `prisma` points to your project's Prisma client instance.
4. Mount the route in your main Express app (`server.ts` or `app.ts`):
   ```typescript
   import attendanceRoutes from './routes/attendanceRoutes';

   app.use('/api/attendance', attendanceRoutes);
   ```

---

### Step 3: Client Setup

1. Copy `client/utils`, `client/components`, and `client/pages` into your frontend `src/` directory.
2. Ensure required client packages are installed in your client `package.json`:
   ```bash
   npm install lucide-react framer-motion axios
   ```
3. Configure your API base URL:
   - The components import `api` from `../services/api` or `../../services/api`.
   - Ensure your Axios instance sends the `Authorization: Bearer <token>` header with requests.
4. Add the routes to your React Router configuration:
   ```tsx
   import { Attendance } from './pages/Attendance';
   import { AttendanceEnrollment } from './pages/attendance/AttendanceEnrollment';
   import { AttendanceSetup } from './pages/attendance/AttendanceSetup';

   <Route path="/attendance" element={<Attendance />} />
   <Route path="/attendance/enrollment" element={<AttendanceEnrollment />} />
   <Route path="/attendance/setup" element={<AttendanceSetup />} />
   ```

---

### Step 4: Environment Variables

Add the following to your server `.env` file:

```env
# Default Office Geolocation (Fallback if none created in DB yet)
OFFICE_LAT=17.4944497
OFFICE_LNG=78.4031731
OFFICE_RADIUS_M=250

# Biometric Encryption (Used for AES-256-GCM face template encryption)
BIOMETRIC_ENCRYPTION_KEY=replace_with_a_secure_random_32_byte_hex_string
```

---

## Verification & Matching Rules

In `server/src/services/biometricService.ts`:
- **Face Match Threshold**:
  - Score `>= 0.85` (85%): Genuine Match Approved.
  - Score `0.80 - 0.84`: Borderline Match (prompts employee to re-scan).
  - Score `< 0.80`: Rejected.
- **Geofence Check**:
  - Compares employee GPS coordinates against the assigned office using the Haversine spherical formula.
  - Allowed distance is bounded by the office's `radiusMeters` setting (default: 200m–250m).
- **Device Lock**:
  - Ensures check-in originates from an enrolled/registered `deviceId`.

