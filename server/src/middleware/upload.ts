import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Ensure folders exist
const uploadsDir = path.join(process.cwd(), 'uploads');
const documentsDir = path.join(process.cwd(), 'documents');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

// Storage configurations
const diskStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    if (file.fieldname === 'document') {
      cb(null, documentsDir);
    } else {
      cb(null, uploadsDir);
    }
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const ext = path.extname(file.originalname);
    const prefix = file.fieldname === 'signature' ? 'sig' : file.fieldname === 'profileImage' ? 'pic' : 'doc';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${prefix}-${uniqueSuffix}${ext}`);
  },
});

// File filter (e.g. enforce PNG for signatures)
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.fieldname === 'signature') {
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Signature must be a PNG image') as any, false);
    }
  } else if (file.fieldname === 'profileImage') {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Profile image must be an image file') as any, false);
    }
  } else {
    // Documents
    cb(null, true);
  }
};

export const upload = multer({
  storage: diskStorage,
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5, // 5MB standard limit
  },
});
