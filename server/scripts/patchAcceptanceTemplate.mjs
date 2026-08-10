// Patches Accepetence_letter.docx to add a "Candidate Information" section with
// docxtemplater placeholders. Everything else in the document stays byte-identical.
// Run: node server/scripts/patchAcceptanceTemplate.mjs
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

const root = path.resolve(process.cwd());
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

const runProps = (opts = {}) => {
  const bold = opts.bold ? '<w:b/><w:bCs/>' : '';
  const color = opts.heading ? '2B2B2B' : '1A1A1A';
  const sz = opts.heading ? '23' : '21';
  return `<w:rPr><w:rFonts w:ascii="Calibri" w:cs="Calibri" w:eastAsia="Calibri" w:hAnsi="Calibri"/>${bold}<w:color w:val="${color}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`;
};

const para = (label, placeholder) => {
  const labelRun = `<w:r>${runProps({ bold: true })}<w:t xml:space="preserve">${label}</w:t></w:r>`;
  const valRun = `<w:r>${runProps()}<w:t xml:space="preserve"> {${placeholder}}</w:t></w:r>`;
  return `<w:p><w:pPr><w:spacing w:after="60" w:line="300"/></w:pPr>${labelRun}${valRun}</w:p>`;
};

const heading = `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:color="DDDDDD" w:sz="4" w:space="2"/></w:pBdr><w:spacing w:after="100" w:before="240"/></w:pPr><w:r>${runProps({ bold: true, heading: true })}<w:t xml:space="preserve">Candidate Information</w:t></w:r></w:p>`;

const lines = [
  ['Date of Birth:', 'dateOfBirth'],
  ['Phone:', 'phone'],
  ['Email:', 'email'],
  ['Position:', 'position'],
  ['Department:', 'department'],
  ['Joining Date:', 'joiningDate'],
  ['Current Address:', 'currentAddress'],
  ['Permanent Address:', 'permanentAddress'],
  ['PAN Number:', 'pan'],
  ['Aadhaar Number:', 'aadhaar'],
  ['Emergency Contact Name:', 'emergencyName'],
  ['Emergency Contact Relationship:', 'emergencyRelationship'],
  ['Emergency Contact Phone:', 'emergencyPhone'],
];

const section = heading + lines.map(([l, p]) => para(l, p)).join('');

// Insert the section right after the welcome paragraph and before the "1. Position" heading.
const anchor = 'We welcome you to Onebridge Infotech and look forward to your contribution.';
const anchorIdx = xml.indexOf(anchor);
if (anchorIdx === -1) {
  console.error('Anchor paragraph not found');
  process.exit(1);
}
const paraEnd = xml.indexOf('</w:p>', anchorIdx);
if (paraEnd === -1) {
  console.error('Anchor paragraph end not found');
  process.exit(1);
}

xml = xml.slice(0, paraEnd + '</w:p>'.length) + section + xml.slice(paraEnd + '</w:p>'.length);

zip.file('word/document.xml', xml);

fs.writeFileSync(templatePath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }), 'binary');
console.log('Template patched successfully:', templatePath);
