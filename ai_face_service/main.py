import os
import sys
import json
import base64
import io
import math
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector

# Paths & Config
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
REC_MODEL_PATH = os.path.join(MODELS_DIR, "recognition.onnx")
DET_MODEL_PATH = os.path.join(MODELS_DIR, "detection.onnx")

POSTGRES_URL = os.environ.get(
    "POSTGRES_URL",
    os.environ.get(
        "DATABASE_URL",
        "postgresql://neondb_owner:npg_YmLBdCqf1QS7@ep-curly-voice-a54f2nr8-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
    )
)

# Standard ArcFace Canonical Reference Landmarks (112x112)
ARCFACE_REFERENCE_5PTS = np.array([
    [38.2946, 51.6963],  # Left Eye
    [73.5318, 51.5014],  # Right Eye
    [56.0252, 71.7366],  # Nose Tip
    [41.5493, 92.3655],  # Left Mouth Corner
    [70.7299, 92.2041],  # Right Mouth Corner
], dtype=np.float32)

def download_models_if_missing():
    os.makedirs(MODELS_DIR, exist_ok=True)
    import urllib.request
    
    # 1. Detection model (SCRFD 2.5MB)
    if not os.path.exists(DET_MODEL_PATH) or os.path.getsize(DET_MODEL_PATH) < 100000:
        det_url = "https://github.com/deepinsight/insightface/releases/download/v0.7/scrfd_500m_bnkps.onnx"
        print(f"Downloading detection model from {det_url}...")
        try:
            urllib.request.urlretrieve(det_url, DET_MODEL_PATH)
            print("Detection model downloaded successfully.")
        except Exception as e:
            print(f"Warning: Failed downloading detection model: {e}")

    # 2. Recognition model (w600k_mbf ArcFace 13.6MB)
    if not os.path.exists(REC_MODEL_PATH) or os.path.getsize(REC_MODEL_PATH) < 1000000:
        rec_url = "https://github.com/deepinsight/insightface/releases/download/v0.7/w600k_mbf.onnx"
        print(f"Downloading recognition model from {rec_url}...")
        try:
            urllib.request.urlretrieve(rec_url, REC_MODEL_PATH)
            print("Recognition model downloaded successfully.")
        except Exception as e:
            print(f"Warning: Failed downloading recognition model: {e}")

class ArcFaceEngine:
    def __init__(self):
        download_models_if_missing()
        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        opts.intra_op_num_threads = 4
        providers = ['CPUExecutionProvider']

        if not os.path.exists(REC_MODEL_PATH):
            raise FileNotFoundError(f"ArcFace model missing at {REC_MODEL_PATH}")
        self.rec_session = ort.InferenceSession(REC_MODEL_PATH, sess_options=opts, providers=providers)
        self.rec_in = self.rec_session.get_inputs()[0].name
        self.rec_out = self.rec_session.get_outputs()[0].name

        self.det_session = None
        if os.path.exists(DET_MODEL_PATH):
            try:
                self.det_session = ort.InferenceSession(DET_MODEL_PATH, sess_options=opts, providers=providers)
                self.det_in = self.det_session.get_inputs()[0].name
            except Exception as e:
                print(f"Notice: detection session init: {e}")

    def decode_image(self, img_input: str) -> Image.Image:
        if img_input.startswith('data:image'):
            img_input = img_input.split(',', 1)[1]
        raw_bytes = base64.b64decode(img_input)
        return Image.open(io.BytesIO(raw_bytes)).convert('RGB')

    def check_quality(self, pil_img: Image.Image, bbox: list):
        w, h = pil_img.size
        bw = bbox[2] - bbox[0]
        bh = bbox[3] - bbox[1]
        if bw < 50 or bh < 50:
            return False, "Face is too small. Please position closer to camera."
        
        face_crop = pil_img.crop((max(0, bbox[0]), max(0, bbox[1]), min(w, bbox[2]), min(h, bbox[3])))
        arr = np.array(face_crop.convert('L'), dtype=np.float32)
        mean_lum = float(np.mean(arr))
        if mean_lum < 35:
            return False, "Lighting is too dark. Please ensure sufficient face illumination."
        if mean_lum > 230:
            return False, "Lighting is overexposed."
        
        lap = np.abs(4 * arr[1:-1, 1:-1] - arr[:-2, 1:-1] - arr[2:, 1:-1] - arr[1:-1, :-2] - arr[1:-1, 2:])
        blur = float(np.var(lap))
        if blur < 16.0:
            return False, "Image is blurry. Please hold steady in front of the camera."

        return True, "Quality verified"

    def estimate_similarity_transform(self, src_pts, dst_pts):
        num = src_pts.shape[0]
        dim = 2
        src_mean = src_pts.mean(axis=0)
        dst_mean = dst_pts.mean(axis=0)
        src_centered = src_pts - src_mean
        dst_centered = dst_pts - dst_mean
        d = np.ones((dim,), dtype=np.float64)
        if np.linalg.det(src_centered.T @ dst_centered) < 0:
            d[dim - 1] = -1
        u, s, vt = np.linalg.svd(src_centered.T @ dst_centered)
        v = vt.T
        r = v @ np.diag(d) @ u.T
        var_src = np.var(src_pts, axis=0).sum()
        scale = 1.0 / var_src * np.dot(s, d) if var_src > 0 else 1.0
        t = dst_mean - scale * (r @ src_mean)
        m = np.zeros((2, 3), dtype=np.float32)
        m[:2, :2] = scale * r
        m[:2, 2] = t
        return m

    def detect_faces(self, pil_img: Image.Image):
        orig_w, orig_h = pil_img.size
        target_size = (640, 640)
        resized_img = ImageOps.pad(pil_img, target_size, color=(0, 0, 0))
        img_arr = np.array(resized_img, dtype=np.float32)
        img_arr = (img_arr - 127.5) / 128.0
        blob = np.transpose(img_arr, (2, 0, 1))[np.newaxis, ...]

        scale = min(640 / orig_w, 640 / orig_h)
        pad_x = (640 - orig_w * scale) / 2
        pad_y = (640 - orig_h * scale) / 2

        if self.det_session is None:
            # Fallback center crop
            cx, cy = orig_w / 2, orig_h / 2
            size = min(orig_w, orig_h) * 0.7
            bbox = [int(cx - size/2), int(cy - size/2), int(cx + size/2), int(cy + size/2)]
            kps = np.array([
                [cx - size*0.18, cy - size*0.1],
                [cx + size*0.18, cy - size*0.1],
                [cx, cy],
                [cx - size*0.12, cy + size*0.18],
                [cx + size*0.12, cy + size*0.18],
            ], dtype=np.float32)
            return [{'bbox': bbox, 'kps': kps, 'score': 0.95}]

        outs = self.det_session.run(None, {self.det_in: blob})
        scores_list = outs[0:3]
        bboxes_list = outs[3:6]
        kpss_list = outs[6:9] if len(outs) >= 9 else []

        faces = []
        for s_feat, b_feat, k_feat in zip(scores_list, bboxes_list, kpss_list if kpss_list else [None]*3):
            scores = s_feat[:, 0]
            pos_inds = np.where(scores >= 0.55)[0]
            for idx in pos_inds:
                box = b_feat[idx]
                x1 = (box[0] - pad_x) / scale
                y1 = (box[1] - pad_y) / scale
                x2 = (box[2] - pad_x) / scale
                y2 = (box[3] - pad_y) / scale
                kp = None
                if k_feat is not None:
                    kp = k_feat[idx].reshape(-1, 2)
                    kp[:, 0] = (kp[:, 0] - pad_x) / scale
                    kp[:, 1] = (kp[:, 1] - pad_y) / scale
                faces.append({'bbox': [int(x1), int(y1), int(x2), int(y2)], 'score': float(scores[idx]), 'kps': kp})

        faces.sort(key=lambda f: f['score'], reverse=True)
        return faces

    def extract_embedding(self, pil_img: Image.Image, face: dict) -> np.ndarray:
        kps = face.get('kps')
        if kps is not None and len(kps) == 5:
            m = self.estimate_similarity_transform(kps, ARCFACE_REFERENCE_5PTS)
            m_inv = cv2_invert_affine(m) if 'cv2_invert_affine' in globals() else None
            # Standard PIL affine transform
            coeffs = [m[0, 0], m[0, 1], m[0, 2], m[1, 0], m[1, 1], m[1, 2]]
            try:
                # Invert 2x3 matrix for PIL transform
                det = m[0, 0]*m[1, 1] - m[0, 1]*m[1, 0]
                if abs(det) > 1e-6:
                    inv_a = m[1, 1] / det
                    inv_b = -m[0, 1] / det
                    inv_d = -m[1, 0] / det
                    inv_e = m[0, 0] / det
                    inv_c = (m[0, 1]*m[1, 2] - m[1, 1]*m[0, 2]) / det
                    inv_f = (m[1, 0]*m[0, 2] - m[0, 0]*m[1, 2]) / det
                    aligned = pil_img.transform((112, 112), Image.AFFINE, (inv_a, inv_b, inv_c, inv_d, inv_e, inv_f), Image.BILINEAR)
                else:
                    aligned = pil_img.crop(face['bbox']).resize((112, 112), Image.BILINEAR)
            except Exception:
                aligned = pil_img.crop(face['bbox']).resize((112, 112), Image.BILINEAR)
        else:
            aligned = pil_img.crop(face['bbox']).resize((112, 112), Image.BILINEAR)

        arr = np.array(aligned, dtype=np.float32)
        arr = (arr - 127.5) / 128.0
        blob = np.transpose(arr, (2, 0, 1))[np.newaxis, ...]

        feat = self.rec_session.run(None, {self.rec_in: blob})[0][0]
        norm = np.linalg.norm(feat)
        if norm > 0:
            feat = feat / norm
        return feat

    def calculate_confidence(self, raw_cosine: float) -> float:
        if raw_cosine >= 0.60:
            p = min(1.0, (raw_cosine - 0.60) / 0.25)
            return round(0.95 + p * 0.045, 4)
        elif raw_cosine >= 0.45:
            p = (raw_cosine - 0.45) / 0.15
            return round(0.90 + p * 0.049, 4)
        elif raw_cosine >= 0.35:
            p = (raw_cosine - 0.35) / 0.10
            return round(0.75 + p * 0.14, 4)
        else:
            p = max(0.0, raw_cosine / 0.35)
            return round(p * 0.74, 4)

# PostgreSQL Connection Helper
def get_db():
    conn = psycopg2.connect(POSTGRES_URL)
    register_vector(conn)
    return conn

# FastAPI App
app = FastAPI(
    title="OneBridge InsightFace ArcFace Engine (PostgreSQL pgvector)",
    version="2.1.0",
    description="High-precision 512-D ArcFace verification microservice for OneBridge HRMS"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = None

@app.on_event("startup")
def startup():
    global engine
    print("Initializing ArcFace Engine...")
    engine = ArcFaceEngine()
    print("ArcFace Engine ready.")

    # Ensure pgvector table exists in PostgreSQL
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS employee_face_embeddings (
                        id SERIAL PRIMARY KEY,
                        employee_id VARCHAR(64) UNIQUE NOT NULL,
                        embedding vector(512) NOT NULL,
                        quality_score REAL,
                        angles_count INTEGER DEFAULT 1,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_employee_face_embeddings_emp_id 
                    ON employee_face_embeddings(employee_id);
                """)
                conn.commit()
        print("PostgreSQL pgvector schema verified.")
    except Exception as e:
        print(f"PostgreSQL connection note: {e}")

class ExtractRequest(BaseModel):
    image: str

class EnrollRequest(BaseModel):
    employee_id: str
    image: str
    angles_count: Optional[int] = 1

class VerifyRequest(BaseModel):
    employee_id: Optional[str] = None
    image: str
    stored_template: Optional[List[float]] = None
    threshold: Optional[float] = 0.95

@app.get("/")
def root():
    return {
        "service": "OneBridge HRMS AI Face Recognition Microservice",
        "status": "online",
        "engine": "InsightFace ArcFace 512-D",
        "database": "Neon PostgreSQL (pgvector)",
        "health_check": "/health",
        "documentation": "/docs"
    }

@app.get("/health")
def health():
    db_ok = False
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM employee_face_embeddings;")
                count = cur.fetchone()[0]
                db_ok = True
    except Exception as e:
        count = -1
    return {
        "status": "ok",
        "model": "InsightFace ArcFace 512-D",
        "database": "Neon PostgreSQL (pgvector)",
        "db_connected": db_ok,
        "enrolled_employees_count": count
    }

@app.post("/extract")
def extract_face(req: ExtractRequest):
    try:
        img = engine.decode_image(req.image)
        faces = engine.detect_faces(img)
        if len(faces) == 0:
            return {"success": False, "error": "NO_FACE_DETECTED", "message": "No face detected in the image."}
        if len(faces) > 1:
            return {"success": False, "error": "MULTIPLE_FACES", "message": "Multiple faces detected. Only one employee allowed."}

        face = faces[0]
        q_ok, q_msg = engine.check_quality(img, face['bbox'])
        if not q_ok:
            return {"success": False, "error": "POOR_QUALITY", "message": q_msg}

        feat = engine.extract_embedding(img, face)
        return {
            "success": True,
            "dimension": len(feat),
            "qualityScore": round(float(face['score']), 4),
            "embedding": [round(float(x), 6) for x in feat],
        }
    except Exception as e:
        return {"success": False, "error": "EXTRACTION_FAILED", "message": str(e)}

@app.post("/enroll")
def enroll_employee(req: EnrollRequest):
    try:
        img = engine.decode_image(req.image)
        faces = engine.detect_faces(img)
        if len(faces) == 0:
            return {"success": False, "error": "NO_FACE_DETECTED", "message": "No face detected for enrollment."}
        if len(faces) > 1:
            return {"success": False, "error": "MULTIPLE_FACES", "message": "Multiple faces detected. Please enroll alone."}

        face = faces[0]
        q_ok, q_msg = engine.check_quality(img, face['bbox'])
        if not q_ok:
            return {"success": False, "error": "POOR_QUALITY", "message": q_msg}

        feat = engine.extract_embedding(img, face)
        feat_list = [float(x) for x in feat]

        # Upsert into PostgreSQL pgvector
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO employee_face_embeddings (employee_id, embedding, quality_score, angles_count, updated_at)
                    VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (employee_id) DO UPDATE SET
                        embedding = EXCLUDED.embedding,
                        quality_score = EXCLUDED.quality_score,
                        angles_count = EXCLUDED.angles_count,
                        updated_at = CURRENT_TIMESTAMP;
                """, (req.employee_id, np.array(feat_list), float(face['score']), req.angles_count or 1))
                conn.commit()

        return {
            "success": True,
            "employee_id": req.employee_id,
            "dimension": 512,
            "qualityScore": round(float(face['score']), 4),
            "message": f"Biometric 512-D ArcFace template securely stored in PostgreSQL pgvector for {req.employee_id}."
        }
    except Exception as e:
        return {"success": False, "error": "ENROLLMENT_FAILED", "message": str(e)}

@app.post("/verify")
def verify_attendance(req: VerifyRequest):
    try:
        img = engine.decode_image(req.image)
        faces = engine.detect_faces(img)
        if len(faces) == 0:
            return {"success": False, "error": "NO_FACE_DETECTED", "message": "No face detected in live camera scan."}
        if len(faces) > 1:
            return {"success": False, "error": "MULTIPLE_FACES", "message": "Multiple faces detected. Only one employee allowed."}

        face = faces[0]
        q_ok, q_msg = engine.check_quality(img, face['bbox'])
        if not q_ok:
            return {"success": False, "error": "POOR_QUALITY", "message": q_msg}

        probe_feat = engine.extract_embedding(img, face)

        # 1. Obtain enrolled vector from PostgreSQL or request payload
        stored_vec = None
        if req.stored_template and len(req.stored_template) == 512:
            stored_vec = np.array(req.stored_template, dtype=np.float32)
        elif req.employee_id:
            with get_db() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        "SELECT embedding FROM employee_face_embeddings WHERE employee_id = %s LIMIT 1;",
                        (req.employee_id,)
                    )
                    row = cur.fetchone()
                    if row and row['embedding'] is not None:
                        stored_vec = np.array(row['embedding'], dtype=np.float32)

        if stored_vec is None:
            return {
                "success": False,
                "error": "NOT_ENROLLED",
                "message": f"No enrolled biometric face template found in PostgreSQL for {req.employee_id or 'employee'}."
            }

        # Normalize vectors
        norm_probe = np.linalg.norm(probe_feat)
        norm_stored = np.linalg.norm(stored_vec)
        if norm_probe > 0:
            probe_feat = probe_feat / norm_probe
        if norm_stored > 0:
            stored_vec = stored_vec / norm_stored

        # Exact ArcFace cosine similarity
        raw_cosine = float(np.dot(probe_feat, stored_vec))
        similarity_score = engine.calculate_confidence(raw_cosine)
        threshold = req.threshold or 0.95

        is_match = similarity_score >= threshold
        decision = "APPROVED" if is_match else ("SCAN_AGAIN" if similarity_score >= 0.90 else "REJECTED")

        return {
            "success": True,
            "isMatch": is_match,
            "similarityScore": similarity_score,
            "rawCosine": round(raw_cosine, 4),
            "decision": decision,
            "qualityScore": round(float(face['score']), 4),
            "message": "Face verified successfully" if is_match else (
                f"Scan borderline ({round(similarity_score * 100)}%). Please hold steady and scan again."
                if decision == "SCAN_AGAIN" else
                f"Face mismatch ({round(similarity_score * 100)}% match, {round(threshold * 100)}% required). Identity does not match."
            )
        }
    except Exception as e:
        return {"success": False, "error": "VERIFICATION_ERROR", "message": str(e)}

@app.delete("/reset/{employee_id}")
@app.post("/reset/{employee_id}")
def reset_biometrics(employee_id: str):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM employee_face_embeddings WHERE employee_id = %s;", (employee_id,))
                deleted = cur.rowcount
                conn.commit()
        return {
            "success": True,
            "employee_id": employee_id,
            "deleted_count": deleted,
            "message": f"Biometric vectors for {employee_id} deleted from PostgreSQL pgvector."
        }
    except Exception as e:
        return {"success": False, "error": "RESET_FAILED", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8008))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
