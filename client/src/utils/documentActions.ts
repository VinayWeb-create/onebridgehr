import { crmService, type DocType } from '../services/crmService';

/** yyyy-mm-dd in the user's local time zone (toISOString would give the UTC date, a day off in IST before 5:30 AM). */
export const localDateInput = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const formatINR = (n: number | undefined | null) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const errorMessage = (err: any, fallback = 'Something went wrong. Please try again.'): string => {
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors.map((e: any) => `${e.field ? e.field + ': ' : ''}${e.message}`).join('\n');
  return data?.message || err?.message || fallback;
};

const revokeLater = (url: string) => setTimeout(() => URL.revokeObjectURL(url), 60_000);

/** Opens the PDF in a new tab. The tab is opened synchronously so popup blockers allow it. */
export const openPdf = async (type: DocType, id: string) => {
  const tab = window.open('', '_blank');
  try {
    const blob = await crmService.getDocumentPdfBlob(type, id);
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;
    revokeLater(url);
  } catch (err) {
    tab?.close();
    throw err;
  }
};

export const downloadPdf = async (type: DocType, id: string, fileName: string) => {
  const blob = await crmService.getDocumentPdfBlob(type, id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  revokeLater(url);
};

/** Prints only the document (not the app page) via a hidden iframe. */
export const printPdf = async (type: DocType, id: string) => {
  const blob = await crmService.getDocumentPdfBlob(type, id);
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      // Some browsers block printing PDFs from iframes; fall back to opening it.
      window.open(url, '_blank');
    }
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  document.body.appendChild(frame);
};

export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
};
