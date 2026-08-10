const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function run() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    if (!user) { console.log('No super admin found'); return; }
    
    const token = jwt.sign({ id: user.id, role: user.role, employeeId: user.employeeId }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' });
    
    const res = await fetch('http://localhost:5000/api/hr-docs/offer-letters', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        candidateName: 'Test',
        candidateEmail: 'test@test.com',
        role: 'Role',
        department: 'Dept',
        salary: '1000',
        joiningDate: '2026-01-01',
        htmlContent: '<p>test</p>'
      })
    });
    const data = await res.json();
    console.log('Response:', data);
  } catch (err) {
    console.log('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
