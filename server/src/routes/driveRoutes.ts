import { Router } from 'express';
import crypto from 'crypto';
import { protect, restrictTo } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { googleOAuth } from '../services/googleOAuth';
import { prisma } from '../config/db';

const router = Router();

// Single-instance in-memory CSRF nonce for the OAuth state param. Fine for
// this single-node deployment; if the app is scaled out, move to shared store.
let pendingState: string | null = null;

/**
 * GET /api/drive/auth
 * Returns the Google consent URL (JWT-protected; the client fetches it with the
 * auth token and then opens it in the browser). A SUPER_ADMIN/HR authorizes the
 * company Google account for Drive access.
 */
router.get('/auth', protect, restrictTo('SUPER_ADMIN', 'HR'), (req, res, next) => {
  try {
    if (!googleOAuth.isConfigured) {
      return next(
        new AppError(
          'Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI in the server .env.',
          503
        )
      );
    }
    pendingState = crypto.randomBytes(16).toString('hex');
    res.json({ success: true, data: { authUrl: googleOAuth.getAuthUrl(pendingState) } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/drive/callback
 * Google redirects back here after the admin approves. Exchanges the code,
 * stores encrypted tokens, then bounces back to the app.
 */
router.get('/callback', async (req, res, next) => {
  const { code, state, error } = req.query;

  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  const redirect = (query: string) => res.redirect(`${frontend}/dashboard?${query}`);

  if (error) {
    return redirect(`drive=error&message=${encodeURIComponent(String(error))}`);
  }
  if (!code || !state) {
    return redirect('drive=error&message=missing_code');
  }
  if (pendingState && state !== pendingState) {
    return redirect('drive=error&message=invalid_state');
  }

  try {
    const email = await googleOAuth.handleCallback(String(code));
    pendingState = null;
    return redirect(`drive=connected&email=${encodeURIComponent(email)}`);
  } catch (err: any) {
    pendingState = null;
    const message = err?.response?.data?.error_description || err?.message || 'connect_failed';
    return redirect(`drive=error&message=${encodeURIComponent(String(message))}`);
  }
});

/**
 * GET /api/drive/status
 * Reports whether Drive is configured/connected and which account is linked.
 */
router.get('/status', protect, restrictTo('SUPER_ADMIN', 'HR'), async (req, res, next) => {
  try {
    const connected = await googleOAuth.refreshStatus();
    let email: string | null = null;
    let expiresAt: Date | null = null;
    if (connected) {
      const conn = await prisma.googleDriveConnection.findFirst();
      email = conn?.driveEmail || null;
      expiresAt = conn?.expiresAt || null;
    }
    res.json({
      success: true,
      data: {
        configured: googleOAuth.isConfigured,
        connected,
        email,
        expiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/drive/disconnect
 * Removes the stored tokens so uploads stop using the connected account.
 */
router.post('/disconnect', protect, restrictTo('SUPER_ADMIN', 'HR'), async (req, res, next) => {
  try {
    await googleOAuth.disconnect();
    res.json({ success: true, data: { connected: false } });
  } catch (err) {
    next(err);
  }
});

export default router;
