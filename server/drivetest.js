require('dotenv').config();
const fs = require('fs');
const { google } = require('googleapis');

async function run() {
  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT;
  let credentials;
  if (raw) {
    credentials = JSON.parse(raw);
  } else {
    const filePath = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE;
    credentials = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  console.log('client_email:', credentials.client_email);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  try {
    await auth.authorize();
    console.log('AUTH OK');
  } catch (e) {
    console.log('AUTH FAILED:', e.message);
  }
}
run();
