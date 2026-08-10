import crypto from 'crypto';
import { google } from 'googleapis';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `http://localhost:${process.env.PORT || 5000}/api/drive/callback`;

const ALGO = 'aes-256-gcm';
const KEY = ((): Buffer => {
  if (process.env.DRIVE_TOKEN_ENCRYPTION_KEY) {
    return Buffer.from(process.env.DRIVE_TOKEN_ENCRYPTION_KEY, 'hex');
  }
  // Fallback: derive a stable 32-byte key from the JWT secret so tokens are
  // still encrypted at rest even when DRIVE_TOKEN_ENCRYPTION_KEY is unset.
  return crypto.createHash('sha256').update(process.env.JWT_SECRET || 'onebridge').digest();
})();

const encrypt = (plain: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
};

const decrypt = (payload: string): string => {
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted token format.');
  }
  const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

class GoogleOAuthService {
  private connected = false;

  public get isConfigured(): boolean {
    return !!(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);
  }

  public get isConnectedFlag(): boolean {
    return this.connected;
  }

  /** Loads connection state from the database (called once at startup). */
  public async init(): Promise<void> {
    this.connected = await this.hasConnection();
  }

  /** Re-checks the database and returns whether a connection exists. */
  public async refreshStatus(): Promise<boolean> {
    this.connected = await this.hasConnection();
    return this.connected;
  }

  private async hasConnection(): Promise<boolean> {
    try {
      const conn = await prisma.googleDriveConnection.findFirst();
      return !!conn;
    } catch {
      return false;
    }
  }

  /** Builds the Google consent URL. Access type offline + prompt consent
   * guarantees a refresh token is issued on first connect. */
  public getAuthUrl(state: string): string {
    const oauth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    return oauth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: DRIVE_SCOPES,
      state,
    });
  }

  /** Exchanges the authorization code for tokens, encrypts them and stores
   * them in the database. Returns the connected account email. */
  public async handleCallback(code: string): Promise<string> {
    const oauth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    const { tokens } = await oauth.getToken(code);

    if (!tokens.access_token) {
      throw new AppError('Google returned no access token.', 400);
    }
    if (!tokens.refresh_token) {
      throw new AppError(
        'Google did not return a refresh token. Reconnect and approve the requested permissions.',
        400
      );
    }

    let driveEmail: string | null = null;
    try {
      const drive = google.drive({ version: 'v3', auth: oauth });
      const about = await drive.about.get({ fields: 'user' });
      driveEmail = about.data.user?.emailAddress || null;
    } catch {
      driveEmail = null;
    }

    await prisma.googleDriveConnection.deleteMany({});
    await prisma.googleDriveConnection.create({
      data: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenType: tokens.token_type || 'Bearer',
        scope: tokens.scope || DRIVE_SCOPES.join(' '),
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000),
        driveEmail,
      },
    });

    this.connected = true;
    return driveEmail || 'Google account';
  }

  /**
   * Returns an authenticated googleapis Drive client. Tokens are loaded from
   * the encrypted DB record; refresh tokens are automatically exchanged and
   * re-encrypted whenever Google issues new ones.
   */
  public async getAuthClient(): Promise<InstanceType<typeof google.auth.OAuth2>> {
    const conn = await prisma.googleDriveConnection.findFirst();
    if (!conn) {
      throw new AppError(
        'Google Drive is not connected. A SUPER_ADMIN/HR must connect the company Google account first.',
        503
      );
    }

    const oauth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    oauth.setCredentials({
      access_token: decrypt(conn.accessToken),
      refresh_token: decrypt(conn.refreshToken),
      token_type: conn.tokenType,
      scope: conn.scope || undefined,
      expiry_date: conn.expiresAt.getTime(),
    });

    oauth.on('tokens', (tokens) => {
      const data: Record<string, unknown> = {};
      if (tokens.access_token) data.accessToken = encrypt(tokens.access_token);
      if (tokens.refresh_token) data.refreshToken = encrypt(tokens.refresh_token);
      if (tokens.expiry_date) data.expiresAt = new Date(tokens.expiry_date);
      if (tokens.scope) data.scope = tokens.scope;
      if (Object.keys(data).length > 0) {
        prisma.googleDriveConnection
          .update({ where: { id: conn.id }, data })
          .catch((err) => console.error('[Drive OAuth] Failed to persist refreshed tokens:', err?.message || err));
      }
    });

    return oauth;
  }

  /** Removes the stored connection so Drive uploads stop using this account. */
  public async disconnect(): Promise<void> {
    await prisma.googleDriveConnection.deleteMany({});
    this.connected = false;
  }
}

export const googleOAuth = new GoogleOAuthService();
export default googleOAuth;
