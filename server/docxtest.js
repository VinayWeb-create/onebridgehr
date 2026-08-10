require('dotenv').config();
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const dir = path.join(process.cwd(), 'documents', 'drive', 'OneBridge HRMS', 'Employees', 'EMP-0001 - AVALA SRI VENKATA GAGNGA VINAY', 'Acceptance');
const docxPath = path.join(dir, 'Internship_Offer_Letter.docx');
const buf = fs.readFileSync(docxPath);
const zip = new PizZip(buf);

const docXml = zip.file('word/document.xml').asText();
const relsXml = zip.file('word/_rels/document.xml.rels').asText();
const contentTypes = zip.file('[Content_Types].xml').asText();

// 1) Strict XML well-formedness via .NET XML parser (catches namespace/well-formedness issues)
const { DOMParser } = require('@xmldom/xmldom'); // may not exist
let parseError = null;
try {
  const parser = new DOMParser({ errorHandler: { warning: (m) => (parseError = m), error: (m) => (parseError = m), fatalError: (m) => (parseError = m) } });
  parser.parseFromString(docXml, 'application/xml');
} catch (e) {
  parseError = e.message;
}
console.log('document.xml parse error:', parseError || 'none');

// 2) r:embed references vs rels ids
const embedIds = [...docXml.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1]);
const relIds = [...relsXml.matchAll(/Id="([^"]+)"/g)].map((m) => m[1]);
const dupRels = relIds.filter((id, i) => relIds.indexOf(id) !== i);
console.log('embed ids:', JSON.stringify([...new Set(embedIds)]));
console.log('dup rel ids:', JSON.stringify(dupRels));
const missing = embedIds.filter((id) => !relIds.includes(id));
console.log('embed ids missing from rels:', JSON.stringify(missing));

// 3) namespace declarations present in document.xml
console.log('root has xmlns:w:', docXml.includes('xmlns:w='));
console.log('root has xmlns:r:', docXml.includes('xmlns:r='));
console.log('root has xmlns:a:', docXml.includes('xmlns:a='));
console.log('root has xmlns:pic:', docXml.includes('xmlns:pic='));
console.log('graphic has xmlns:a:', /<a:graphic[^>]*xmlns:a=/.test(docXml));
console.log('pic has xmlns:pic:', /<pic:pic[^>]*xmlns:pic=/.test(docXml));

// 4) media files + content types
const media = Object.keys(zip.files).filter((n) => n.startsWith('word/media/'));
console.log('media:', JSON.stringify(media));
console.log('contentTypes has png:', contentTypes.includes('png'));
console.log('contentTypes has docx overrides:', contentTypes.includes('document.xml'));

// 5) check rels target for signature
const sigRel = [...relsXml.matchAll(/<Relationship[^>]*Media\/signature\.png[^>]*>/g)].map((m) => m[0]);
console.log('signature rel:', JSON.stringify(sigRel));
