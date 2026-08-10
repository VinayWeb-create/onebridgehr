const fs = require('fs');
const PizZip = require('pizzip');
const b = fs.readFileSync('documents/drive/OneBridge HRMS/Employees/EMP-0001 - AVALA SRI VENKATA GAGNGA VINAY/Acceptance/Internship_Offer_Letter.docx');
const z = new PizZip(b);
const xml = z.file('word/document.xml').asText();
const stack = [];
const re = /<\/?([a-zA-Z0-9_]+:[a-zA-Z0-9_]+)((?:"[^"]*"|[^>"])*)>/g;
let m;
while ((m = re.exec(xml)) !== null) {
  const full = m[0];
  const name = m[1];
  const selfClose = full.endsWith('/>');
  if (full.startsWith('</')) {
    const top = stack.pop();
    if (top !== name) {
      console.log('MISMATCH at offset', m.index, ': expected close of', top, 'got', name);
      console.log('context:', xml.slice(m.index - 150, m.index + 150));
      process.exit(0);
    }
  } else if (!selfClose) {
    stack.push(name);
  }
}
console.log('balanced tags:', stack.length === 0 ? 'yes' : 'no, leftover: ' + stack.slice(0, 8));
