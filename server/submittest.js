require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const TOKEN = '8a509f1463c0f88114268ee4f2e5c213530a401076bf3f6874bbdfcb41186661';

function tinyPngDataUrl() {
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return `data:image/png;base64,${b64}`;
}

async function run() {
  const candidateData = {
    fullName: 'AVALA SRI VENKATA GAGNGA VINAY',
    email: 'avalavinay4@gmail.com',
    phone: '9999999999',
    dateOfBirth: '2000-01-01',
    gender: 'Male',
    permanentAddress: 'Hyderabad',
    currentAddress: 'Hyderabad',
    aadhaar: '123456789012',
    pan: 'ABCDE1234F',
    emergencyContact: { name: 'Emergency', phone: '8888888888', relationship: 'Father' },
    signatureType: 'DRAW',
    signatureData: tinyPngDataUrl(),
    signatureText: '',
    signatureStyle: "'Brush Script MT', cursive",
    signatureSize: 44,
  };

  const form = new FormData();
  form.append('candidateData', JSON.stringify(candidateData));

  const png = Buffer.from(tinyPngDataUrl().split(',')[1], 'base64');
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');

  form.append('aadhaar', new Blob([pdf], { type: 'application/pdf' }), 'aadhaar.pdf');
  form.append('pan', new Blob([pdf], { type: 'application/pdf' }), 'pan.pdf');
  form.append('resume', new Blob([pdf], { type: 'application/pdf' }), 'resume.pdf');
  form.append('passportPhoto', new Blob([png], { type: 'image/png' }), 'photo.png');
  form.append('certificates', new Blob([pdf], { type: 'application/pdf' }), 'cert1.pdf');
  form.append('certificates', new Blob([pdf], { type: 'application/pdf' }), 'cert2.pdf');
  form.append('otherDocuments', new Blob([png], { type: 'image/png' }), 'extra.png');

  try {
    const res = await fetch(`http://localhost:5000/api/onboarding/portal/${TOKEN}/submit`, {
      method: 'POST',
      body: form,
    });
    const text = await res.text();
    console.log('SUBMIT Status:', res.status);
    if (res.ok) {
      const json = JSON.parse(text);
      console.log('documents count:', json.data.documents?.length);
      console.log('folderUrl:', json.data.folderUrl);
      json.data.documents.forEach((d) => console.log(`  - ${d.type}: ${d.fileName}`));
    } else {
      console.log('SUBMIT ERROR BODY:', text);
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
  await prisma.$disconnect();
}
run();
