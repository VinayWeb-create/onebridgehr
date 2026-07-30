import { prisma } from './config/db';
import bcrypt from 'bcrypt';
import { qrService } from './services/qrService';

// 1x1 transparent PNG image base64, used as a placeholder signature
const MOCK_SIGNATURE_BASE64 = 
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqWDxlAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5gcIERcdCsz6QwAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkSub2AAABgklEQVR42u3bT0sUYRwF8M+4a4tWkS1cC4JWtWjRIrroDfoC3aAvILroDYxWrVpEtGgR1T/QoqL/5CjPzFwHM+vsOjs4DzxzN8ObeZ+59547d2acnJyccEwxVqM1WqM1WqM1WqM1WqM1WqM1WqM1WqM1WqM1WqM1WqM1WqM1WqM1WqM1/n+MzXQ059jO+W7OQY5W9uY4yfHM3hyv0uT8d46vOc6z5+xnz3eO/XzH2ctZ12d8T8fOaI15xO4s1mK5w3n+6cZyzrEd4yPzFfM1p2t1sX/2t/Wk56TvpO/u7p6u18X+FfM18/W1v71fOd9zvlqjNebRO9r75/v7Ww5W0Wgdj+ZszXGS4zmHeZzjnP45vub80bGejuaO5hwbOb4mOfrZk6OPPbn72ZN7P98dF5/rM/0Hw5jXnK6tJ7P1pPfP/rae/Hz2t/fHlQdjtEZrjM2cr9ZojdZojdZojdZojdZojdZojdYom98l5+X32Jm3hQAAAABJRU5ErkJggg==';

async function seed() {
  console.log('Clearing database...');
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.document.deleteMany();
  await prisma.payroll.deleteMany();
  await prisma.task.deleteMany();
  await prisma.leave.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();

  console.log('Creating Seed Users...');
  const salt = await bcrypt.genSalt(10);
  const adminHash = await bcrypt.hash('admin123', salt);
  const hrHash = await bcrypt.hash('hr12345', salt);
  const tlHash = await bcrypt.hash('lead123', salt);
  const empHash = await bcrypt.hash('emp1234', salt);

  const validityDate = new Date();
  validityDate.setFullYear(validityDate.getFullYear() + 5);

  const qrOBI0001 = await qrService.generateEmployeeQr('OBI0001');
  const qrOBI0002 = await qrService.generateEmployeeQr('OBI0002');
  const qrOBI0003 = await qrService.generateEmployeeQr('OBI0003');
  const qrOBI0004 = await qrService.generateEmployeeQr('OBI0004');

  // 1. Super Admin (OBI0001)
  const adminEmp = await prisma.employee.create({
    data: {
      employeeId: 'OBI0001',
      firstName: 'Deeraj',
      lastName: 'Kumar',
      email: 'superadmin@onebridge.com',
      phone: '9876543210',
      department: 'Management',
      designation: 'CEO / Director',
      bloodGroup: 'O+',
      validity: validityDate,
      qrCodeUrl: qrOBI0001,
      personalInfo: {
        panCard: 'ABCDE1234F',
        aadharCard: '123456789012',
        passportNumber: 'Z1234567',
        drivingLicense: 'DL-1234567890',
        dob: new Date('1985-05-15'),
        gender: 'Male',
      },
      professionalInfo: {
        dateOfJoining: new Date('2020-01-01'),
      },
      emergencyContact: {
        name: 'Sonia Kumar',
        relationship: 'Spouse',
        phone: '9876543211',
      },
    },
  });

  await prisma.user.create({
    data: {
      email: 'superadmin@onebridge.com',
      passwordHash: adminHash,
      role: 'SUPER_ADMIN',
      employeeId: 'OBI0001',
    },
  });

  // 2. HR Manager (OBI0002) - Pre-save transparent signature URL
  const hrEmp = await prisma.employee.create({
    data: {
      employeeId: 'OBI0002',
      firstName: 'Irifan',
      lastName: 'Khan',
      email: 'hr@onebridge.com',
      phone: '9876543220',
      department: 'Human Resources',
      designation: 'HR Manager',
      bloodGroup: 'A+',
      validity: validityDate,
      qrCodeUrl: qrOBI0002,
      signatureUrl: MOCK_SIGNATURE_BASE64, // Local seeding fallback
      personalInfo: {
        panCard: 'FGHIJ5678K',
        aadharCard: '234567890123',
        dob: new Date('1990-08-22'),
        gender: 'Male',
      },
      professionalInfo: {
        dateOfJoining: new Date('2021-06-15'),
      },
      emergencyContact: {
        name: 'Amina Khan',
        relationship: 'Mother',
        phone: '9876543221',
      },
    },
  });

  await prisma.user.create({
    data: {
      email: 'hr@onebridge.com',
      passwordHash: hrHash,
      role: 'HR',
      employeeId: 'OBI0002',
    },
  });

  // 3. Team Lead (OBI0003)
  const tlEmp = await prisma.employee.create({
    data: {
      employeeId: 'OBI0003',
      firstName: 'Uday',
      lastName: 'Pratap',
      email: 'lead@onebridge.com',
      phone: '9876543230',
      department: 'Engineering',
      designation: 'Team Lead',
      bloodGroup: 'B+',
      validity: validityDate,
      qrCodeUrl: qrOBI0003,
      personalInfo: {
        panCard: 'LMNOP9012Q',
        aadharCard: '345678901234',
        dob: new Date('1988-11-10'),
        gender: 'Male',
      },
      professionalInfo: {
        dateOfJoining: new Date('2022-03-01'),
      },
      emergencyContact: {
        name: 'Vijay Pratap',
        relationship: 'Father',
        phone: '9876543231',
      },
    },
  });

  await prisma.user.create({
    data: {
      email: 'lead@onebridge.com',
      passwordHash: tlHash,
      role: 'TEAM_LEAD',
      employeeId: 'OBI0003',
    },
  });

  // 4. Employee (OBI0004)
  const devEmp = await prisma.employee.create({
    data: {
      employeeId: 'OBI0004',
      firstName: 'Vinay',
      lastName: 'Kumar',
      email: 'employee@onebridge.com',
      phone: '9876543240',
      department: 'Engineering',
      designation: 'Software Engineer',
      bloodGroup: 'AB-',
      validity: validityDate,
      qrCodeUrl: qrOBI0004,
      skills: ['TypeScript', 'React.js', 'Node.js', 'Express', 'MongoDB'],
      education: [
        {
          degree: 'B.Tech in Computer Science',
          institution: 'VTU Belgaum',
          passingYear: 2021,
          percentage: 82.5,
        },
      ],
      experience: [
        {
          company: 'Infosys Pvt Ltd',
          designation: 'System Engineer',
          years: 2.0,
          description: 'Frontend Web development using React.js',
        },
      ],
      personalInfo: {
        panCard: 'RSTUV3456W',
        aadharCard: '456789012345',
        dob: new Date('1998-02-04'),
        gender: 'Male',
      },
      professionalInfo: {
        dateOfJoining: new Date('2023-10-01'),
      },
      emergencyContact: {
        name: 'Sunita Kumar',
        relationship: 'Sister',
        phone: '9876543241',
      },
    },
  });

  await prisma.user.create({
    data: {
      email: 'employee@onebridge.com',
      passwordHash: empHash,
      role: 'EMPLOYEE',
      employeeId: 'OBI0004',
    },
  });

  console.log('Seeding Attendance Records...');
  // Seed attendance for OBI0004 for the last 5 days
  const attendanceDates = [1, 2, 3, 4, 5].map((offset) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  for (const date of attendanceDates) {
    const checkIn = new Date(date);
    checkIn.setHours(9, 15 + Math.round(Math.random() * 20), 0, 0); // ~9:15 to 9:35

    const checkOut = new Date(date);
    checkOut.setHours(18, Math.round(Math.random() * 30), 0, 0); // ~18:00 to 18:30

    let isLate = checkIn.getHours() > 9 || (checkIn.getHours() === 9 && checkIn.getMinutes() > 30);

    await prisma.attendance.create({
      data: {
        employeeId: 'OBI0004',
        date,
        checkIn,
        checkOut,
        status: isLate ? 'LATE' : 'PRESENT',
        lateMinutes: isLate ? checkIn.getMinutes() - 30 : 0,
        workFromHome: false,
      },
    });
  }

  console.log('Seeding Tasks...');
  // Task 1
  await prisma.task.create({
    data: {
      title: 'Complete HR Dashboard Core Integration',
      description: 'Hook up React query controllers and verify Redux local states for authentication headers.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      dueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000), // 5 days from now
      employeeId: 'OBI0004',
      assignedById: 'OBI0003', // assigned by TL
      progress: 60,
      subtasks: [
        { title: 'Define Axios client instances', isCompleted: true },
        { title: 'Build React context listeners', isCompleted: true },
        { title: 'Create skeleton charts for attendance', isCompleted: false },
      ],
    },
  });

  // Task 2
  await prisma.task.create({
    data: {
      title: 'Upload Transparent Signature',
      description: 'Upload digital signature PNG under 2MB for automatic experience letter generation.',
      priority: 'MEDIUM',
      status: 'PENDING',
      dueDate: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      employeeId: 'OBI0004',
      assignedById: 'OBI0002', // assigned by HR
      progress: 0,
    },
  });

  console.log('Seeding Leaves...');
  // Leave 1 - approved
  const lStart = new Date();
  lStart.setDate(lStart.getDate() - 15);
  const lEnd = new Date(lStart);
  lEnd.setDate(lEnd.getDate() + 2);

  await prisma.leave.create({
    data: {
      employeeId: 'OBI0004',
      leaveType: 'CASUAL',
      startDate: lStart,
      endDate: lEnd,
      reason: 'Attending family functions out of town.',
      status: 'HR_APPROVED',
      managerApprovalId: 'OBI0003',
      hrApprovalId: 'OBI0002',
      managerComment: 'Approved, handover complete.',
      hrComment: 'Processed and leave balance updated.',
    },
  });

  // Leave 2 - pending
  const lStart2 = new Date();
  lStart2.setDate(lStart2.getDate() + 10);
  const lEnd2 = new Date(lStart2);
  lEnd2.setDate(lEnd2.getDate() + 1);

  await prisma.leave.create({
    data: {
      employeeId: 'OBI0004',
      leaveType: 'SICK',
      startDate: lStart2,
      endDate: lEnd2,
      reason: 'Dental appointment and follow-up surgery.',
      status: 'PENDING',
    },
  });

  console.log('Seeding Payroll History...');
  await prisma.payroll.create({
    data: {
      employeeId: 'OBI0004',
      month: 6,
      financialYear: '2026-2027',
      payslipNumber: 'PS-OBI0004-202606',
      basic: 30000,
      hra: 12000,
      da: 4000,
      allowance: 5000,
      bonus: 2000,
      pf: 3600,
      esi: 500,
      professionalTax: 200,
      incomeTax: 1000,
      netSalary: 47700,
      status: 'PAID',
    },
  });

  console.log('Database Seeding Completed Successfully! 🌱');
}

seed()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
