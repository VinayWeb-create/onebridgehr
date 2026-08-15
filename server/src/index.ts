import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';

// Load config
dotenv.config();

// Imports
import { prisma } from './config/db';
import { errorHandler } from './middleware/errorHandler';
import { socketService } from './services/socketService';
import { startOnboardingScheduler } from './services/onboardingScheduler';

// Routes
import authRoutes from './routes/authRoutes';
import employeeRoutes from './routes/employeeRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import leaveRoutes from './routes/leaveRoutes';
import taskRoutes from './routes/taskRoutes';
import payrollRoutes from './routes/payrollRoutes';
import reportRoutes from './routes/reportRoutes';
import hrDocumentRoutes from './routes/hrDocumentRoutes';
import financeRoutes from './routes/financeRoutes';
import onboardingRoutes from './routes/onboardingRoutes';
import driveRoutes from './routes/driveRoutes';
import { googleOAuth } from './services/googleOAuth';

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const PORT = parseInt(process.env.PORT || '5000');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// 1. Web Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 2. CORS Integration
app.use(
  cors({
    origin: [FRONTEND_URL, 'http://localhost:5173', 'https://onebridgehr.vercel.app', 'https://hrms.onebridgeinfotech.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  })
);

// 3. Request Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api', limiter);

// 5. Static Files Serving (Signatures, Profiles, Payslip PDFs)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/documents', express.static(path.join(process.cwd(), 'documents')));

// 6. Socket.io setup
socketService.init(server, FRONTEND_URL);

// 7. Health Check
app.get('/health', async (_req, res) => {
  try {
    await prisma.user.findFirst();
    res.status(200).json({ status: 'success', db: 'connected', time: new Date() });
  } catch (err: any) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// Root Welcome Endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Welcome to the OneBridge HR Management API Service!',
    version: '1.0.0',
    health: `${req.protocol}://${req.get('host')}/health`,
  });
});

// 8. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportRoutes);
  app.use('/api/hr-docs', hrDocumentRoutes);
  app.use('/api/finance', financeRoutes);
  app.use('/api/onboarding', onboardingRoutes);
app.use('/api/drive', driveRoutes);

// Fallback Route
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`,
  });
});

// 9. Centralized Error Handler
app.use(errorHandler);

// 10. Start Server and verify DB Connection
const startServer = async () => {
  try {
    console.log('Connecting to database...');
    // In Prisma + MongoDB, a connection is lazy established on first call. 
    // We can do a dummy query or user lookup to verify the link.
    await prisma.user.findFirst();
    console.log('Database connected successfully.');
  } catch (error) {
    console.warn('⚠️ Database connection failed or timed out. Continuing in offline mode...', error);
  }

  try {
    await googleOAuth.init();
    console.log(
      googleOAuth.isConnectedFlag
        ? 'Google Drive connected (OAuth).'
        : 'Google Drive not connected. Use the Dashboard to connect a company Google account.'
    );

    server.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
    startOnboardingScheduler();
  } catch (error) {
    console.error('Failed to start server services:', error);
    process.exit(1);
  }
};

startServer();
