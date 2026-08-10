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
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  bloodGroup: z.string().optional(),
  validity: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  currentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  
  personalInfo: personalInfoSchema.optional(),
  professionalInfo: professionalInfoSchema.optional(),
  emergencyContact: emergencyContactSchema.optional(),
  education: z.array(educationSchema).optional(),
  experience: z.array(experienceSchema).optional(),
  skills: z.array(z.string()).optional(),
  certificates: z.array(certificateSchema).optional(),
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
  status: z.enum(['PENDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'REJECTED', 'OVERDUE']).optional(),
  progress: z.number().min(0).max(100).optional(),
  subtasks: z.array(z.object({
    title: z.string(),
    isCompleted: z.boolean(),
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
