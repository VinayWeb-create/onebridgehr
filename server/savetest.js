require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
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
  try {
    const res = await fetch(`http://localhost:5000/api/onboarding/portal/${TOKEN}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateData }),
    });
    const text = await res.text();
    console.log('SAVE Status:', res.status);
    if (res.ok) {
      const json = JSON.parse(text);
      console.log('docx url:', json.data.docx?.url);
      console.log('pdf url:', json.data.pdf?.url);
      const url = json.data.docx?.url;
      if (!url) { console.log('No docx url'); return; }
      const docxRes = await fetch(url.startsWith('http') ? url : `http://localhost:5000${url}`);
      console.log('docx fetch status:', docxRes.status);
      const buf = Buffer.from(await docxRes.arrayBuffer());
      const PizZip = require('pizzip');
      const zip = new PizZip(buf);
      const xml = zip.file('word/document.xml').asText();
      const rels = zip.file('word/_rels/document.xml.rels').asText();
      console.log('media signature.png present:', !!zip.file('word/media/signature.png'));
      console.log('signature rel present:', rels.includes('media/signature.png'));
      console.log('underscore runs remaining:', (xml.match(/(_{3,})/g) || []).length);
      console.log('drawings:', (xml.match(/<w:drawing>/g) || []).length);
      console.log('bank tags remaining:', (xml.match(/\{bank[A-Za-z]*\}/g) || []).length);
      console.log('signature placeholder text present:', xml.includes('Signature:'));
    } else {
      console.log('SAVE ERROR BODY:', text);
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
  await prisma.$disconnect();
}
run();
