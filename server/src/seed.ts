import { prisma } from './config/db';
import bcrypt from 'bcrypt';
import { qrService } from './services/qrService';

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

  const validityDate = new Date();
  validityDate.setFullYear(validityDate.getFullYear() + 5);

  const qrOBI0001 = await qrService.generateEmployeeQr('OBI0001');
  const qrOBI111 = await qrService.generateEmployeeQr('OBI111');


  // 1. Uday Kumar C (OBI0001) - SUPER_ADMIN
  await prisma.employee.create({
    data: {
      employeeId: 'OBI0001',
      firstName: 'Uday Kumar',
      lastName: 'C',
      email: 'hr@onebridgeinfotech.com',
      phone: '9398355196',
      department: 'Management',
      designation: 'Founder & Managing Director',
      bloodGroup: 'O+',
      validity: validityDate,
      currentAddress: 'Sathyabama Complex, Bhagya Nagar Colony, KPHB, Hyderabad, Telangana 500072',
      permanentAddress: 'Sathyabama Complex, Bhagya Nagar Colony, KPHB, Hyderabad, Telangana 500072',
      qrCodeUrl: qrOBI0001,
      signatureUrl: MOCK_SIGNATURE_BASE64,
      personalInfo: {
        panCard: 'ABCDE1234F',
        aadharCard: '123456789012',
        dob: new Date('1985-05-15'),
        gender: 'Male',
      },
      professionalInfo: {
        dateOfJoining: new Date('2020-01-01'),
      }
    },
  });

  await prisma.user.create({
    data: {
      email: 'hr@onebridgeinfotech.com',
      passwordHash: adminHash,
      role: 'SUPER_ADMIN',
      employeeId: 'OBI0001',
    },
  });

  // 2. Mohammed Irfan (OBI1117) - SUPER_ADMIN
  await prisma.employee.create({
    data: {
      employeeId: 'OBI1117',
      firstName: 'Mohammed',
      lastName: 'Irfan',
      email: 'mohammed.irfan@onebridgeinfotech.com',
      phone: '9876543211',
      department: 'Management',
      designation: 'Associate Director',
      bloodGroup: 'A+',
      validity: validityDate,
      currentAddress: 'GoLive Plaza, Hitech City, Hyderabad, Telangana 500081',
      permanentAddress: 'GoLive Plaza, Hitech City, Hyderabad, Telangana 500081',
      qrCodeUrl: qrOBI111,
      signatureUrl: MOCK_SIGNATURE_BASE64,
      personalInfo: {
        panCard: 'FGHIJ5678K',
        aadharCard: '234567890123',
        dob: new Date('1990-08-22'),
        gender: 'Male',
      },
      professionalInfo: {
        dateOfJoining: new Date('2021-06-15'),
      }
    },
  });

  await prisma.user.create({
    data: {
      email: 'mohammed.irfan@onebridgeinfotech.com',
      passwordHash: adminHash,
      role: 'SUPER_ADMIN',
      employeeId: 'OBI1117',
    },
  });

  console.log('Database Seeding Completed Successfully! 🌱');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
