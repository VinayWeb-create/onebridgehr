// Removes the Bank Name / Bank Account Number / IFSC Code paragraphs from
// Accepetence_letter.docx (the acceptance letter template).
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

const root = path.resolve(process.cwd(), '..');
const templatePath = path.join(root, 'Accepetence_letter.docx');

if (!fs.existsSync(templatePath)) {
  console.error(`Template not found at ${templatePath}`);
  process.exit(1);
}

const zip = new PizZip(fs.readFileSync(templatePath, 'binary'));
const docXmlEntry = zip.file('word/document.xml');
if (!docXmlEntry) {
  console.error('word/document.xml not found');
  process.exit(1);
}

let xml = docXmlEntry.asText();

const placeholders = ['{bankName}', '{bankAccount}', '{bankIfsc}'];
let removed = 0;
for (const ph of placeholders) {
  const idx = xml.indexOf(ph);
  if (idx === -1) {
    console.warn(`Placeholder ${ph} not found, skipping`);
    continue;
  }
  const pStart = xml.lastIndexOf('<w:p>', idx);
  const pEnd = xml.indexOf('</w:p>', idx) + '</w:p>'.length;
  if (pStart === -1 || pEnd === -1) {
    console.error(`Could not locate enclosing paragraph for ${ph}`);
    process.exit(1);
  }
  xml = xml.slice(0, pStart) + xml.slice(pEnd);
  removed += 1;
}

if (removed === 0) {
  console.log('No bank placeholders found; template already clean.');
} else {
  zip.file('word/document.xml', xml);
  fs.writeFileSync(templatePath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }), 'binary');
  console.log(`Removed ${removed} bank field paragraph(s). Template updated:`, templatePath);
}
