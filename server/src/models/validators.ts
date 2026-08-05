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
  email: z.string().email('Invalid email address'),
  role: z.enum(['SUPER_ADMIN', 'HR', 'TEAM_LEAD', 'EMPLOYEE']),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  department: z.string().min(1, 'Department is required'),
  designation: z.string().min(1, 'Designation is required'),
  bloodGroup: z.string().min(1, 'Blood group is required'),
  validity: z.string().or(z.date()).transform((val) => new Date(val)),
  
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
