import dotenv from 'dotenv';
dotenv.config();
import { prisma } from './src/config/db';

(async () => {
  const onboardings = await prisma.onboarding.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { offerLetter: true, employee: true },
  });

  for (const ob of onboardings) {
    console.log('=== ONBOARDING ===');
    console.log('id:', ob.id, '| candidateId:', ob.candidateId, '| status:', ob.status);
    console.log('token:', ob.token);
    console.log('offerLetter:', JSON.stringify({
      candidateName: ob.offerLetter?.candidateName,
      candidateEmail: ob.offerLetter?.candidateEmail,
      role: ob.offerLetter?.role,
      department: ob.offerLetter?.department,
      joiningDate: ob.offerLetter?.joiningDate,
    }, null, 2));
    console.log('employee linked:', ob.employee ? {
      employeeId: ob.employee.employeeId,
      firstName: ob.employee.firstName,
      lastName: ob.employee.lastName,
      email: ob.employee.email,
      phone: ob.employee.phone,
      department: ob.employee.department,
      designation: ob.employee.designation,
      currentAddress: ob.employee.currentAddress,
      permanentAddress: ob.employee.permanentAddress,
      personalInfo: ob.employee.personalInfo,
      emergencyContact: ob.employee.emergencyContact,
    } : 'NULL');
    console.log('candidateData:', JSON.stringify(ob.candidateData)?.slice(0, 600));
    console.log();

    // Email lookup fallback
    if (!ob.employee && ob.offerLetter?.candidateEmail) {
      const byEmail = await prisma.employee.findFirst({
        where: { email: { equals: ob.offerLetter.candidateEmail, mode: 'insensitive' } },
      });
      console.log('employee by email match:', byEmail ? byEmail.employeeId : 'NONE');
    }
  }

  const empCount = await prisma.employee.count();
  const matching = await prisma.employee.findMany({
    where: { email: { in: ['avalavinay2005@gmail.com', 'avalavinay7@gmail.com'] } },
    select: { employeeId: true, firstName: true, lastName: true, email: true, phone: true },
  });
  console.log('total employees:', empCount);
  console.log('matching emails:', JSON.stringify(matching));

  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
