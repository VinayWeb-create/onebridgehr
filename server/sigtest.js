const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const templatePath = 'C:/Users/user/Downloads/Corporate Email Signature Design – Figma Make_files/Accepetence_letter.docx';

const formatDate = (date) => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

const normalizeValue = (value) => (value === null || value === undefined ? '' : String(value));

const content = fs.readFileSync(templatePath, 'binary');
const zip = new PizZip(content);
const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
doc.render({
  referenceNumber: 'OBI/HR/OL/2026/0001',
  date: formatDate(new Date()),
  candidateName: 'Test Candidate',
  currentAddress: 'Hyderabad',
  permanentAddress: 'Hyderabad',
  joiningDate: formatDate(new Date()),
  place: 'Hyderabad',
  dateOfBirth: '2000-01-01',
  phone: '9999999999',
  email: 'test@test.com',
  position: 'Intern',
  department: 'Engineering',
  pan: 'ABCDE1234F',
  aadhaar: '123456789012',
  emergencyName: 'Emergency',
  emergencyRelationship: 'Father',
  emergencyPhone: '8888888888',
  bankName: 'SBI',
  bankAccount: '12345',
  bankIfsc: 'SBIN0000001',
});

const outBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

const outZip = new PizZip(outBuffer);
const xml = outZip.file('word/document.xml').asText();
const underscoreMatches = xml.match(/(_+)/g);
console.log('Underscore runs remaining after render:', underscoreMatches ? underscoreMatches.length : 0);
const sigRunMatches = xml.match(/(<w:r>)(<w:rPr>[\s\S]*?<\/w:rPr>)?(<w:t[^>]*>)(_{3,})(<\/w:t><\/w:r>)/g);
console.log('Signature-run regex matches:', sigRunMatches ? sigRunMatches.length : 0);

const remainingTags = xml.match(/\{[a-zA-Z]+\}/g);
console.log('Remaining placeholder tags after render:', remainingTags ? [...new Set(remainingTags)] : []);
