import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  rememberMe: z.boolean().optional(),
});

export const personalInfoSchema = z.object({
  panCard: z.string().optional(),
  aadharCard: z.string().optional(),
  passportNumber: z.string().optional(),
  drivingLicense: z.string().optional(),
  dob: z.string().or(z.date()).transform((val) => new Date(val)),
  gender: z.string(),
});

export const professionalInfoSchema = z.object({
  dateOfJoining: z.string().or(z.date()).transform((val) => new Date(val)),
  offerLetterUrl: z.string().optional(),
  joiningLetterUrl: z.string().optional(),
  resumeUrl: z.string().optional(),
});

export const emergencyContactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  relationship: z.string().min(1, 'Relationship is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
});

export const educationSchema = z.object({
  degree: z.string().min(1, 'Degree is required'),
  institution: z.string().min(1, 'Institution is required'),
  passingYear: z.number().int().min(1950).max(new Date().getFullYear() + 5),
  percentage: z.number().optional(),
});

export const experienceSchema = z.object({
  company: z.string().min(1, 'Company is required'),
  designation: z.string().min(1, 'Designation is required'),
  years: z.number().min(0),
  description: z.string().optional(),
});

export const certificateSchema = z.object({
  name: z.string().min(1, 'Certificate name is required'),
  issuedBy: z.string().min(1, 'Issued by is required'),
  issueDate: z.string().or(z.date()).transform((val) => new Date(val)),
  expiryDate: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  credentialUrl: z.string().optional(),
});

export const registerEmployeeSchema = z.object({
  employeeId: z.string().optional(),
  email: z.string().email('Invalid email address'),
  role: z.enum(['SUPER_ADMIN', 'HR', 'TEAM_LEAD', 'EMPLOYEE']),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  department: z.string().min(1, 'Department is required'),
  designation: z.string().min(1, 'Designation is required'),
  bloodGroup: z.string().min(1, 'Blood group is required'),
  validity: z.string().or(z.date()).transform((val) => new Date(val)),
  currentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  
  personalInfo: personalInfoSchema,
  professionalInfo: professionalInfoSchema.optional(),
  emergencyContact: emergencyContactSchema.optional(),
  education: z.array(educationSchema).optional(),
  experience: z.array(experienceSchema).optional(),
  skills: z.array(z.string()).optional(),
  certificates: z.array(certificateSchema).optional(),
});

export const updateEmployeeSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters long').optional().or(z.literal('')),
  role: z.enum(['SUPER_ADMIN', 'HR', 'TEAM_LEAD', 'EMPLOYEE']).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  bloodGroup: z.string().optional(),
  validity: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  currentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  profileImageUrl: z.string().optional(),
  signatureUrl: z.string().optional(),
  
  personalInfo: personalInfoSchema.optional(),
  professionalInfo: professionalInfoSchema.optional(),
  salaryStructure: z.object({
    basic: z.number().optional(),
    hra: z.number().optional(),
    da: z.number().optional(),
    allowance: z.number().optional(),
    bonus: z.number().optional(),
    pf: z.number().optional(),
    esi: z.number().optional(),
    professionalTax: z.number().optional(),
    incomeTax: z.number().optional(),
  }).optional(),
  emergencyContact: emergencyContactSchema.optional(),
  education: z.array(educationSchema).optional(),
  experience: z.array(experienceSchema).optional(),
  skills: z.array(z.string()).optional(),
  certificates: z.array(certificateSchema).optional(),
  customUrl: z.string().optional(),
});

export const checkInSchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  workFromHome: z.boolean().default(false),
});

export const leaveSchema = z.object({
  leaveType: z.enum(['CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'LOSS_OF_PAY']),
  startDate: z.string().or(z.date()).transform((val) => new Date(val)),
  endDate: z.string().or(z.date()).transform((val) => new Date(val)),
  reason: z.string().min(5, 'Reason must be at least 5 characters long'),
});

export const leaveReviewSchema = z.object({
  status: z.enum(['MANAGER_APPROVED', 'HR_APPROVED', 'REJECTED']),
  comment: z.string().optional(),
});

export const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.string().min(1, 'Task description is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  dueDate: z.string().or(z.date()).transform((val) => new Date(val)),
  employeeId: z.string().regex(/^OBI\d{4}$/, 'Assignee Employee ID must be OBIxxxx'),
  dependencies: z.array(z.string()).optional(),
  isRecurring: z.boolean().default(false),
  recurrenceCron: z.string().optional(),
  subtasks: z.array(z.object({
    title: z.string().min(1),
    isCompleted: z.boolean().default(false),
  })).optional(),
});

export const taskUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  dueDate: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  employeeId: z.string().optional(),
  projectName: z.string().optional(),
  expectedHours: z.number().optional(),
  riskLevel: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'REJECTED', 'OVERDUE']).optional(),
  progress: z.number().min(0).max(100).optional(),
  subtasks: z.array(z.object({
    title: z.string(),
    isCompleted: z.boolean().default(false),
  })).optional(),
  timeLogMinutes: z.number().optional(),
  comment: z.string().optional(),
});

export const payrollSchema = z.object({
  employeeId: z.string().regex(/^OBI\d{4}$/, 'Employee ID must be OBIxxxx'),
  month: z.number().min(1).max(12),
  financialYear: z.string().regex(/^\d{4}-\d{4}$/, 'Financial Year must be format YYYY-YYYY (e.g. 2026-2027)'),
  basic: z.number().min(0),
  hra: z.number().min(0),
  da: z.number().min(0),
  allowance: z.number().min(0),
  bonus: z.number().min(0),
  pf: z.number().min(0),
  esi: z.number().min(0),
  professionalTax: z.number().min(0),
  incomeTax: z.number().min(0),
});

export const attendanceCodeSchema = z.object({
  code: z.string().length(6, 'Attendance code must be 6 characters'),
});

export const qrCheckInSchema = z.object({
  token: z.string().min(1, 'QR token is required'),
});

export const gpsCheckInSchema = z.object({
  latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
});

export const attendanceReportSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  startDate: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  endDate: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  department: z.string().optional(),
  employeeId: z.string().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'HOLIDAY', 'WORK_FROM_HOME', 'REMOTE', 'ON_LEAVE']).optional(),
  isLate: z.boolean().optional(),
});

export const holidaySchema = z.object({
  name: z.string().min(1, 'Holiday name is required'),
  date: z.string().or(z.date()).transform((val) => new Date(val)),
  type: z.enum(['PUBLIC', 'RESTRICTED', 'COMPANY_SPECIFIC']).default('PUBLIC'),
  description: z.string().optional(),
});

export const holidayCalendarSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const enhancedLeaveSchema = z.object({
  leaveType: z.enum(['CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'LOSS_OF_PAY', 'EMERGENCY', 'HALF_DAY', 'COMP_OFF', 'MEDICAL']),
  startDate: z.string().or(z.date()).transform((val) => new Date(val)),
  endDate: z.string().or(z.date()).transform((val) => new Date(val)),
  isHalfDay: z.boolean().default(false),
  halfDayPeriod: z.enum(['MORNING', 'AFTERNOON']).optional(),
  isEmergency: z.boolean().default(false),
  reason: z.string().min(5, 'Reason must be at least 5 characters long'),
  attachments: z.array(z.string()).optional(),
});

export const managerLeaveApprovalSchema = z.object({
  managerComment: z.string().min(1, 'Manager comment is required for approval'),
});

export const hrLeaveApprovalSchema = z.object({
  hrComment: z.string().min(1, 'HR comment is required for approval').optional(),
});

export const rejectLeaveSchema = z.object({
  comment: z.string().min(1, 'Rejection reason is required'),
});

export const leaveAnalyticsSchema = z.object({
  startDate: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  endDate: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  department: z.string().optional(),
});

const VALID_TRANSACTION_TYPES = ['REVENUE', 'EXPENSE'] as const;
const VALID_CATEGORIES = [
  'SALARY', 'OFFICE_EXPENSE', 'SOFTWARE', 'MARKETING', 'TRAINING',
  'RECRUITMENT', 'VENDOR', 'TAX', 'OTHER', 'CONSULTING', 'CLIENT_PAYMENT',
  'INVOICE', 'SUBSCRIPTION', 'BONUS', 'COMMISSION', 'TRAVEL', 'UTILITIES',
  'RENT', 'EQUIPMENT', 'LEGAL', 'INSURANCE'
] as const;
const VALID_STATUSES = ['PENDING', 'COMPLETED', 'OVERDUE'] as const;

export const financeTransactionSchema = z.object({
  type: z.enum(VALID_TRANSACTION_TYPES, {
    required_error: 'Transaction type is required (REVENUE or EXPENSE)',
  }),
  category: z.enum(VALID_CATEGORIES, {
    required_error: 'Category is required (e.g. SALARY, OFFICE_EXPENSE, SOFTWARE)',
  }),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  description: z.string().min(3, 'Description must be at least 3 characters'),
  date: z.string().or(z.date()).transform((val) => new Date(val)),
  reference: z.string().optional(),
  paidBy: z.string().optional(),
  status: z.enum(VALID_STATUSES).optional().default('COMPLETED'),
  department: z.string().optional(),
  employeeId: z.string().optional(),
});

export const financeTransactionUpdateSchema = z.object({
  type: z.enum(VALID_TRANSACTION_TYPES).optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
  amount: z.number().min(0.01).optional(),
  description: z.string().min(3).optional(),
  date: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  reference: z.string().optional(),
  paidBy: z.string().optional(),
  status: z.enum(VALID_STATUSES).optional(),
  department: z.string().optional(),
  employeeId: z.string().optional(),
});

// ==========================================
// Billing (companies & clients for quotations/invoices)
// ==========================================
const optionalText = (max = 500) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

// PNG/JPEG as a data URL, max ~500 KB of image data
const imageDataUrl = z
  .string()
  .regex(/^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/, 'Image must be a PNG or JPEG')
  .max(700_000, 'Image must be smaller than 500 KB')
  .optional()
  .nullable();

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const gstin = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .nullable()
  .refine((v) => !v || GSTIN_REGEX.test(v), 'Invalid GSTIN format')
  .transform((v) => (v ? v : null));

const emailList = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine(
    (v) => !v || v.split(',').every((e) => z.string().email().safeParse(e.trim()).success),
    'Enter valid email addresses separated by commas'
  )
  .transform((v) => (v ? v : null));

const ifscCode = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .nullable()
  .refine((v) => !v || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), 'Invalid IFSC code')
  .transform((v) => (v ? v : null));

export const bankAccountSchema = z.object({
  id: z.string().max(64).optional().nullable(),
  label: optionalText(60),
  accountName: optionalText(200),
  bankName: optionalText(200),
  accountNumber: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || /^[0-9A-Za-z]{6,34}$/.test(v), 'Account number should be 6–34 letters/digits without spaces')
    .transform((v) => (v ? v : null)),
  ifsc: ifscCode,
  branch: optionalText(200),
  swift: optionalText(20),
  isDefault: z.boolean().optional().default(false),
});

export const billingCompanySchema = z.object({
  name: z.string().trim().min(2, 'Company name is required').max(200),
  gstin,
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable()
    .refine((v) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v), 'Invalid PAN format')
    .transform((v) => (v ? v : null)),
  email: z.string().trim().email('Invalid email').optional().nullable().or(z.literal('')).transform((v) => (v ? v : null)),
  phone: optionalText(30),
  website: optionalText(200),
  addressLine1: optionalText(),
  addressLine2: optionalText(),
  city: optionalText(100),
  state: optionalText(100),
  stateCode: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || /^[0-9]{2}$/.test(v), 'State code must be 2 digits')
    .transform((v) => (v ? v : null)),
  pincode: optionalText(10),
  country: z.string().trim().max(100).optional().default('India'),
  logoDataUrl: imageDataUrl,
  signatureDataUrl: imageDataUrl,
  stampDataUrl: imageDataUrl,
  bankAccountName: optionalText(200),
  bankName: optionalText(200),
  bankAccountNumber: optionalText(40),
  bankIfsc: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable()
    .refine((v) => !v || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), 'Invalid IFSC code')
    .transform((v) => (v ? v : null)),
  bankBranch: optionalText(200),
  bankSwift: optionalText(20),
  upiId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(v), 'Invalid UPI ID')
    .transform((v) => (v ? v : null)),
  bankAccounts: z.array(bankAccountSchema).max(10, 'At most 10 bank accounts').optional(),
  quotationTerms: optionalText(5000),
  invoiceTerms: optionalText(5000),
  defaultNotes: optionalText(5000),
  emailCc: emailList,
  isActive: z.boolean().optional(),
});

export const billingClientSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required').max(200),
  company: optionalText(200),
  email: z.string().trim().email('Invalid email').optional().nullable().or(z.literal('')).transform((v) => (v ? v : null)),
  phone: optionalText(30),
  gstin,
  billingAddress: optionalText(1000),
  state: optionalText(100),
  stateCode: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || /^[0-9]{2}$/.test(v), 'State code must be 2 digits')
    .transform((v) => (v ? v : null)),
  leadId: z.string().regex(/^[a-f0-9]{24}$/i).optional().nullable(),
});

// ==========================================
// Quotation / Invoice documents
// ==========================================
const money = z.coerce.number().finite().min(0, 'Must be 0 or more');
const optionalObjectId = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v && /^[a-f0-9]{24}$/i.test(v) ? v : null));
const optionalDate = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid date' });
      return z.NEVER;
    }
    return d;
  });

export const billingLineItemSchema = z.object({
  description: z.string().trim().min(1, 'Item name is required').max(500),
  details: optionalText(2000),
  hsnSac: z.string().trim().max(20).optional().nullable().transform((v) => v || undefined),
  quantity: z.coerce.number().finite().min(0).default(1),
  unit: z.string().trim().max(20).optional().nullable().transform((v) => v || undefined),
  unitPrice: money,
  taxPercent: z.coerce.number().finite().min(0).max(100).optional().nullable(),
});

const billingDocumentBase = {
  companyId: optionalObjectId,
  clientId: optionalObjectId,
  poNumber: optionalText(60),
  bankAccountId: z.string().trim().max(64).optional().nullable().transform((v) => v || null),
  clientName: z.string().trim().min(1, 'Client name is required').max(200),
  clientCompany: optionalText(200),
  clientEmail: z.string().trim().email('Enter a valid client email'),
  clientPhone: optionalText(30),
  clientGst: gstin,
  items: z.array(billingLineItemSchema).min(1, 'Add at least one item').max(200),
  taxPercent: z.coerce.number().finite().min(0).max(100).optional().default(18),
  discountAmount: money.optional().default(0),
  additionalCharges: money.optional().default(0),
  additionalChargesLabel: optionalText(100),
  placeOfSupplyCode: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || /^[0-9]{2}$/.test(v), 'Invalid place of supply')
    .transform((v) => v || null),
  termsAndConditions: optionalText(10000),
  notes: optionalText(10000),
};

export const quotationDocumentSchema = z.object({
  ...billingDocumentBase,
  leadId: optionalObjectId,
  title: optionalText(200),
  clientAddress: optionalText(1000),
  validUntil: optionalDate,
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED']).optional(),
});

export const invoiceDocumentSchema = z.object({
  ...billingDocumentBase,
  quotationId: optionalObjectId,
  billingAddress: optionalText(1000),
  issueDate: optionalDate,
  dueDate: optionalDate,
  isDraft: z.boolean().optional().default(false),
  // Only used on create: an advance already received
  amountPaid: money.optional().default(0),
  paymentMethod: optionalText(40),
  paymentReference: optionalText(100),
});

export const recordPaymentSchema = z.object({
  paymentAmount: z.coerce.number().finite().gt(0, 'Payment amount must be more than 0'),
  paymentMethod: z.string().trim().max(40).optional().default('BANK_TRANSFER'),
  paymentReference: optionalText(100),
  paymentDate: optionalDate,
  notes: optionalText(500),
});
