const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function run() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    if (!user) { console.log('No super admin found'); return; }
    
    const token = jwt.sign({ id: user.id, role: user.role, employeeId: user.employeeId }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' });
    
    const offerLetter = await prisma.offerLetter.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!offerLetter) { console.log('no offer letter'); return; }
    
    const res = await fetch('http://localhost:5000/api/hr-docs/offer-letters/' + offerLetter.id, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        candidateName: 'Test Updated',
        salary: '2000'
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
