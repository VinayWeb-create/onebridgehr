# OneBridge HRMS - Face Recognition AI Microservice (Railway + pgvector)

High-precision 512-dimensional **InsightFace ArcFace** biometric verification engine for OneBridge Infotech HRMS.

## Architecture

- **Primary HRMS Database**: MongoDB Atlas (Employees, Attendance, Policies, Payroll, etc.)
- **Biometric Vectors**: Neon PostgreSQL with `pgvector` extension (`employee_face_embeddings` table)
- **AI Microservice**: Python FastAPI + ONNX Runtime (deployable on Railway)
- **Node.js HRMS Backend**: Render (calls Railway via `AI_FACE_SERVICE_URL`)

---

## 1-Click Railway Deployment Instructions

1. **Create a new project on Railway**:
   - Go to [Railway Dashboard](https://railway.app).
   - Click **New Project** -> **Deploy from GitHub repo**.
   - Select your repository: `VinayWeb-create/onebridgehr`.
   - Set the Root Directory to: `/ai_face_service` (or leave default if deploying root with Dockerfile).

2. **Configure Environment Variables in Railway**:
   Add this environment variable in the Railway Service settings:
   ```env
   POSTGRES_URL=postgresql://neondb_owner:npg_YmLBdCqf1QS7@ep-curly-voice-a54f2nr8-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   PORT=8008
   ```

3. **Generate Public Domain on Railway**:
   - In Railway Settings -> **Networking** -> click **Generate Domain** (e.g. `https://onebridge-face-ai.up.railway.app`).

4. **Update Render Backend Environment Variables**:
   In your Render dashboard for `onebridgehr.onrender.com`:
   - Set:
     ```env
     AI_FACE_SERVICE_URL=https://onebridge-face-ai.up.railway.app
     ```
   - Done! Your Render backend will now stream face verifications directly to your Railway ArcFace engine with Neon PostgreSQL pgvector.

---

## API Endpoints

- `GET /health` - Verifies engine status, ArcFace 512-D model, and PostgreSQL pgvector connection.
- `POST /enroll` - Enrolls an employee's face into PostgreSQL `employee_face_embeddings`.
- `POST /verify` - Compares a live probe image against the employee's enrolled vector with 95% threshold.
- `POST /extract` - Extracts 512-D normalized vector from a face image.
- `DELETE /reset/{employee_id}` - Removes the employee's vector from PostgreSQL.
