import crypto from 'crypto';
import { spawn } from 'child_process';
import path from 'path';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = crypto
  .createHash('sha256')
  .update(process.env.BIOMETRIC_ENCRYPTION_KEY || 'codabs_smart_attendance_face_biometric_key_2026')
  .digest();

/**
 * Securely encrypts face template vector (128-D or 512-D) using AES-256-GCM
 */
export function encryptFaceTemplate(embedding: number[]): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, SECRET_KEY, iv);

  const jsonStr = JSON.stringify(embedding);
  let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts face template vector
 */
export function decryptFaceTemplate(encryptedPayload: string): number[] {
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted face template payload');
    }
    const [ivHex, authTagHex, encryptedDataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, SECRET_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedDataHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to decrypt face template:', error);
    throw new Error('Failed to decrypt biometric face template');
  }
}

/**
 * Cosine similarity between two feature vectors (values normalized in 0..1)
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, Math.round(similarity * 10000) / 10000));
}

export interface FaceMatchVerificationResult {
  isMatch: boolean;
  rescanRequired?: boolean;
  similarityScore: number;
  rawCosine?: number;
  reason?: string;
}

/**
 * Validates and verifies live face embedding against permanently stored biometric template.
 * Strictly verifies identity against the enrolled employee only.
 * Threshold rules:
 * >= 95%: Approve
 * 90-95%: Borderline, scan again
 * < 90%: Reject
 */
export function verifyFaceBiometricMatch(
  liveEmbedding: number[],
  storedTemplate: number[],
  threshold = 0.95
): FaceMatchVerificationResult {
  if (!liveEmbedding || !storedTemplate || !Array.isArray(liveEmbedding) || !Array.isArray(storedTemplate)) {
    return {
      isMatch: false,
      similarityScore: 0,
      reason: 'Biometric face embedding data is missing or invalid',
    };
  }

  if (liveEmbedding.length !== storedTemplate.length || (liveEmbedding.length !== 128 && liveEmbedding.length !== 512)) {
    return {
      isMatch: false,
      similarityScore: 0,
      reason: `Biometric vector dimension mismatch (live: ${liveEmbedding.length}, stored: ${storedTemplate.length})`,
    };
  }

  const liveNormSq = liveEmbedding.reduce((sum, val) => sum + val * val, 0);
  const storedNormSq = storedTemplate.reduce((sum, val) => sum + val * val, 0);

  if (liveNormSq === 0 || storedNormSq === 0) {
    return {
      isMatch: false,
      similarityScore: 0,
      reason: 'Biometric face vector contains all zeros (no face detected or invalid capture)',
    };
  }

  const rawCosine = calculateCosineSimilarity(liveEmbedding, storedTemplate);
  let similarityScore = rawCosine;

  // Calibrate 512-D ArcFace continuous cosine into human-readable 0% - 100% confidence curve:
  // (In ArcFace, cosine >= 0.60 corresponds to FAR < 1e-5 same identity; cosine < 0.40 is distinct person)
  if (liveEmbedding.length === 512) {
    if (rawCosine >= 0.60) {
      similarityScore = 0.95 + ((rawCosine - 0.60) / 0.40) * 0.05;
    } else if (rawCosine >= 0.45) {
      similarityScore = 0.90 + ((rawCosine - 0.45) / 0.15) * 0.05;
    } else if (rawCosine >= 0.30) {
      similarityScore = 0.60 + ((rawCosine - 0.30) / 0.15) * 0.30;
    } else {
      similarityScore = Math.max(0, rawCosine * 2.0);
    }
    similarityScore = Math.round(similarityScore * 10000) / 10000;
  }

  const isMatch = similarityScore >= threshold;
  const rescanRequired = !isMatch && similarityScore >= 0.90;

  let reason: string | undefined;
  if (!isMatch) {
    if (rescanRequired) {
      reason = `Face scan borderline (${Math.round(similarityScore * 100)}% match). Please hold steady and scan again with direct lighting.`;
    } else {
      reason = `Biometric face match failed (${Math.round(similarityScore * 100)}% match, minimum ${Math.round(threshold * 100)}% required). Identity does not match enrolled employee.`;
    }
  }

  return {
    isMatch,
    rescanRequired,
    similarityScore,
    rawCosine,
    reason,
  };
}

export interface InsightFaceResponse {
  success: boolean;
  faceCount?: number;
  embedding?: number[];
  dimension?: number;
  qualityScore?: number;
  livenessScore?: number;
  similarityScore?: number;
  rawCosine?: number;
  decision?: 'APPROVED' | 'SCAN_AGAIN' | 'REJECTED';
  error?: string;
  message?: string;
}

/**
 * Invokes the production-grade InsightFace ArcFace engine
 */
export async function callInsightFaceEngine(
  imageInput: string,
  storedTemplate?: number[],
  threshold = 0.95
): Promise<InsightFaceResponse> {
  return new Promise((resolve) => {
    try {
      const scriptPath = path.resolve(__dirname, '../ai_service/face_engine.py');
      const pyProcess = spawn('py', [scriptPath], {
        cwd: path.resolve(__dirname, '../..'),
      });

      let stdoutData = '';
      let stderrData = '';

      const payload = JSON.stringify({
        image: imageInput,
        storedTemplate: storedTemplate || null,
        threshold,
      });

      pyProcess.stdin.write(payload);
      pyProcess.stdin.end();

      pyProcess.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      pyProcess.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      pyProcess.on('close', (code) => {
        if (code === 0 && stdoutData.trim()) {
          try {
            const parsed = JSON.parse(stdoutData.trim());
            return resolve(parsed);
          } catch (e) {
            console.error('Failed to parse InsightFace stdout:', stdoutData);
          }
        }
        console.warn('InsightFace CLI failed or exited with code', code, stderrData);
        // Fallback response
        resolve({
          success: false,
          error: 'PYTHON_ENGINE_UNAVAILABLE',
          message: stderrData || 'InsightFace Python engine call failed',
        });
      });

      pyProcess.on('error', (err) => {
        console.error('InsightFace process execution error:', err);
        resolve({
          success: false,
          error: 'PROCESS_ERROR',
          message: err.message,
        });
      });
    } catch (err: any) {
      resolve({
        success: false,
        error: 'EXCEPTION',
        message: err.message,
      });
    }
  });
}

/**
 * Haversine formula to calculate distance between two coordinates in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
