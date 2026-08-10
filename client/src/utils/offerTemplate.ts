export const getTemplate = (d: any) => {
  // Helpers for safe rendering
  const text = (val: string | undefined, fallback: string) => val ? val : fallback;
  const companySealHTML = d.companySealDataUrl ? `<img src="${d.companySealDataUrl}" style="max-height: 80px;" alt="Company Seal" />` : '<em>(Company Seal)</em>';
  const signatorySigHTML = d.authorizedSignatureDataUrl ? `<img src="${d.authorizedSignatureDataUrl}" style="max-height: 50px;" alt="Signature" />` : '';
  const companyLogoHTML = d.companyLogoDataUrl ? `<img src="${d.companyLogoDataUrl}" style="max-height: 60px; margin-bottom: 10px;" alt="Company Logo" />` : '';

  return `
<div style="font-family: 'Helvetica', 'Arial', sans-serif; padding: 0; color: #000; line-height: 1.5; font-size: 14px; text-align: justify;">

<!-- HEADER -->
<div style="text-align: center; margin-bottom: 20px;">
  ${companyLogoHTML}
  <h2 style="margin: 0; font-size: 18px; color: #1e3a8a;"><strong>ONEBRIDGE INFOTECH PRIVATE LIMITED</strong></h2>
  <p style="margin: 0; font-size: 12px;">202, Sathyabama Complex, Bhagya Nagar Colony, KPHB, Hyderabad, Telangana 500072, India</p>
  <p style="margin: 0; font-size: 12px;">CIN: U85500TS2024PTC186604  |  hr@onebridgeinfotech.com  |  +91 93983 55196  |  www.onebridgeinfotech.com</p>
</div>

<hr style="border: 0; border-top: 1px solid #ccc; margin-bottom: 20px;" />

<div style="text-align: center; margin-bottom: 20px;">
  <h3 style="margin: 0; font-size: 16px; text-decoration: underline;"><strong>INTERNSHIP OFFER LETTER</strong></h3>
  <p style="margin: 0; font-size: 12px;"><em>Private & Confidential</em></p>
</div>

<table width="100%" style="margin-bottom: 20px; border: none; font-size: 14px;">
  <tr>
    <td align="left"><strong>Ref. No.:</strong> ${text(d.referenceNumber, 'OBI/HR/OL/____________')}</td>
    <td align="right"><strong>Date:</strong> ${text(d.offerDate, '____________________')}</td>
  </tr>
</table>

<p style="margin-bottom: 20px;">
  To,<br/>
  <strong>Mr./Ms.:</strong> ${text(d.candidateName, '________________________________________')}<br/>
  <strong>Address:</strong> ${text(d.address, '________________________________________')}, ${text(d.city, '')} ${text(d.state, '')} ${text(d.pinCode, '')}
</p>

<p><strong>Subject: Offer of Internship</strong></p>

<p>Dear Mr./Ms. <strong>${text(d.candidateName, '____________________')}</strong>,</p>

<p>We are pleased to offer you an opportunity to join <strong>Onebridge Infotech Private Limited</strong> (the “Company”) as an Intern.</p>

<p>Your selection is based upon your academic background, discussions during the interview process, and our assessment of your potential to contribute to the Company's growth.</p>

<p>This Offer Letter outlines the principal commercial terms of your internship. Your engagement shall also be governed by the Employment Agreement, the Confidentiality, Intellectual Property & Data Protection Agreement, the Employee Handbook, the Information Security Policy, and other Company policies that you will be required to execute or acknowledge on or before your joining date.</p>

<p>We welcome you to Onebridge Infotech and look forward to your contribution.</p>

<p><strong>1. Position</strong></p>
<p>You are being engaged as an <strong>Intern</strong> under the Company's Future Builders internship program.</p>
<p>This internship is intended to provide structured training, practical exposure, and performance evaluation.</p>
<p>This internship does not constitute confirmation of permanent employment.</p>

<p><strong>2. Internship Duration</strong></p>
<p>Your internship shall commence on the Joining Date: <strong>${text(d.joiningDate, '____________________')}</strong> for an initial period of <strong>${text(d.internshipDuration, 'Six (6)')} Months</strong>.</p>
<p>During this period your performance, technical competence, communication, professionalism, ethics, attendance, learning ability, and business suitability shall be evaluated.</p>

<p><strong>3. Confirmation of Employment</strong></p>
<p>Upon successful completion of the internship and subject to:</p>
<ul style="margin-top: 0; padding-left: 20px;">
  <li>satisfactory performance;</li>
  <li>successful completion of assigned learning objectives;</li>
  <li>compliance with Company policies;</li>
  <li>business requirements; and</li>
  <li>availability of suitable positions,</li>
</ul>
<p>the Company may, at its sole discretion, offer you regular employment in an appropriate role. The role, designation, and compensation for any such regular employment shall be decided by the Company based on your performance during the internship period.</p>
<p>The Company is under no obligation to offer permanent employment after completion of the internship.</p>

<p><strong>4. Probation</strong></p>
<p>If regular employment is offered and accepted, you shall initially be placed on probation for <strong>${text(d.probationPeriod, 'six (6)')} months</strong>, unless otherwise notified in writing.</p>
<p>Confirmation of employment shall be subject to satisfactory performance during probation.</p>

<p><strong>5. Place of Work</strong></p>
<p>Your primary place of work shall be <strong>${text(d.workLocation, 'Onebridge Infotech Private Limited, Hyderabad, Telangana')}</strong>, or any other location, client site, or remote work arrangement as determined by the Company.</p>

<p><strong>6. Working Hours</strong></p>
<p>Your normal working schedule shall be communicated by your Reporting Manager (${text(d.reportingManager, '____________')}).</p>
<p>Based on business requirements, you may be required to work additional hours, rotational shifts, weekends, or public holidays in accordance with applicable law.</p>

<p><strong>7. Internship Stipend</strong></p>
<p>Your stipend and applicable benefits shall be as specified in <strong>Annexure A</strong> attached to this Offer Letter.</p>
<p>All statutory deductions, if applicable, shall be made in accordance with law.</p>

<p><strong>8. Background Verification</strong></p>
<p>This offer is conditional upon successful verification of your educational qualifications, identity, address, previous employment (if applicable), and any other information furnished by you.</p>
<p>Any material misrepresentation or concealment may result in withdrawal of this offer or termination of your engagement.</p>

<p><strong>9. Joining Requirements</strong></p>
<p>On or before your joining date, you shall be required to:</p>
<ul style="margin-top: 0; padding-left: 20px;">
  <li>produce original educational documents;</li>
  <li>provide valid identity and address proof;</li>
  <li>complete all joining documentation;</li>
  <li>execute the Employment Agreement;</li>
  <li>execute the Confidentiality, Intellectual Property & Data Protection Agreement; and</li>
  <li>acknowledge receipt of Company policies.</li>
</ul>

<p><strong>10. Confidentiality, Intellectual Property & Data Protection</strong></p>
<p>During your internship you may have access to confidential and proprietary information of the Company and its clients, including but not limited to source code, software, algorithms, system designs, architecture documents, product roadmaps, business ideas, inventions, client lists, pricing, financial information, credentials, and personal data (collectively, “Confidential Information”).</p>
<p>You agree that at all times, during and after your internship, you shall:</p>
<ul style="margin-top: 0; padding-left: 20px;">
  <li>hold all Confidential Information in strict confidence and use it solely for performing duties assigned by the Company;</li>
  <li>not copy, remove, transmit, upload, share, disclose, or retain any source code, data, documents, ideas, or materials — in any form — outside authorized Company systems (including to personal email, personal devices, personal cloud storage, or public/private code repositories);</li>
  <li>not disclose any Confidential Information to any third party, including on social media, without prior written authorization of the Company;</li>
  <li>handle all personal data strictly in accordance with the Digital Personal Data Protection Act, 2023 and the Company's Information Security and Data Protection policies;</li>
  <li>return or permanently delete, as instructed, all Company property, data, and materials upon completion or termination of the internship.</li>
</ul>
<p>All work products, deliverables, code, inventions, designs, ideas, and improvements created by you, alone or jointly, during the internship (“Work Product”) shall be the sole and exclusive property of the Company, and shall be deemed assigned to the Company upon creation, to the fullest extent permitted under the Copyright Act, 1957 and other applicable laws. You waive, to the extent permissible, any moral or other rights in the Work Product.</p>
<p>You acknowledge that the Company's systems, networks, and devices may be monitored and audited in accordance with applicable law and Company policy.</p>

<p><strong>11. Data & Source Code Violations — Legal Consequences</strong></p>
<p>You are hereby put on express notice that any theft, leak, unauthorized access, copying, disclosure, or misuse of the Company's or its clients' data, source code, Confidential Information, or intellectual property constitutes a serious violation of law, and may expose you to civil and criminal liability, including without limitation under:</p>
<ul style="margin-top: 0; padding-left: 20px;">
  <li>the Information Technology Act, 2000 — including Sections 43 (penalty for damage to computer systems), 65 (tampering with computer source documents), 66 (computer-related offences), 66B (dishonestly receiving stolen computer resources), and 72 (breach of confidentiality and privacy) — offences under which are punishable with imprisonment and/or fine;</li>
  <li>the Bharatiya Nyaya Sanhita, 2023 — including provisions relating to theft, criminal breach of trust, and cheating;</li>
  <li>the Copyright Act, 1957 — including Section 63 (knowing infringement of copyright, punishable with imprisonment and fine);</li>
  <li>the Digital Personal Data Protection Act, 2023 — including monetary penalties for unauthorized processing or disclosure of personal data.</li>
</ul>
<p>Without prejudice to the above, in the event of any actual or threatened breach, the Company shall be entitled to:</p>
<ul style="margin-top: 0; padding-left: 20px;">
  <li>immediate termination of your internship/engagement without notice;</li>
  <li>injunctive and equitable relief before competent courts;</li>
  <li>recovery of damages, losses, and legal costs; and</li>
  <li>initiation of criminal proceedings before the appropriate law-enforcement authorities, which may result in prosecution and imprisonment as provided under applicable law.</li>
</ul>
<p>These obligations survive the completion, termination, or non-conversion of your internship, without limitation of time with respect to trade secrets and personal data.</p>

<p><strong>12. Confidentiality Before Joining</strong></p>
<p>The contents of this Offer Letter and any information shared during the recruitment process shall be treated as confidential and shall not be disclosed except where required by law.</p>

<p><strong>13. Conditions of Offer</strong></p>
<p>This Offer is subject to:</p>
<ul style="margin-top: 0; padding-left: 20px;">
  <li>successful completion of pre-employment formalities;</li>
  <li>satisfactory background verification;</li>
  <li>your acceptance of Company policies;</li>
  <li>execution of required agreements; and</li>
  <li>your joining the Company on or before the joining date specified.</li>
</ul>

<p><strong>14. Withdrawal of Offer</strong></p>
<p>The Company reserves the right to withdraw or revoke this Offer before your joining if:</p>
<ul style="margin-top: 0; padding-left: 20px;">
  <li>information supplied by you is inaccurate or misleading;</li>
  <li>background verification is unsatisfactory;</li>
  <li>required documents are not submitted;</li>
  <li>you fail to join within the stipulated period without written approval; or</li>
  <li>there is any other legitimate business reason consistent with applicable law.</li>
</ul>

<p><strong>15. Termination of Internship</strong></p>
<p>During the internship, either party may terminate the engagement by giving fifteen (15) days' written notice. The Company may terminate the internship with immediate effect, without notice or payment in lieu thereof, in the event of misconduct, breach of Company policies, breach of confidentiality or data protection obligations, unsatisfactory performance, or unauthorized absence.</p>

<p><strong>16. Early Exit, Continuity and Buyout</strong></p>
<p>This internship is a Company-sponsored training engagement. The Company invests substantial time and resources in selection, mentoring, and training. The Intern is expected to complete the full program duration of six (6) months.</p>
<p>If the Intern wishes to leave before completion of the program (including for another opportunity), the Intern shall elect one of the following tracks:</p>
<p><strong>(A) Replacement Continuity & Knowledge Transfer:</strong> The Intern shall continue until a replacement joins and shall complete knowledge transfer to such replacement (or to the Intern's manager, if so directed). This continuity period shall be for a minimum of two (2) months and a maximum of three (3) months from the date of written resignation. If no replacement joins within three (3) months, the Intern may be relieved after completing knowledge transfer to the reporting manager and clearance.</p>
<p><strong>(B) Buyout:</strong> The Intern may exit earlier by paying a Training Investment Buyout amount as determined by the Company with reference to the training program cost and the period of the program completed, completing a written handover, returning Company property and access, and obtaining clearance. The process for determination and settlement is set out in Annexure B.</p>
<p><strong>(C) Unauthorized Exit / Non-Cooperation:</strong> If the Intern absconds, abandons the engagement, resigns without electing (A) or (B), or refuses knowledge transfer or handover, the Company may treat the engagement as terminated for breach, recover the applicable Training Investment Buyout on the same basis as under (B) (and notice pay in lieu, if notice is not served), withhold relieving and experience documentation until settlement and clearance, and pursue remedies for any confidentiality, data, or intellectual property breach under this letter.</p>
<p>Upon completion of the elected track (or settlement under Track C) and clearance, the Company shall process relieving formalities and issue the internship certificate. Confidentiality and intellectual property obligations shall survive exit. This Clause shall not apply where the Company terminates without misconduct, or where exit is approved for documented medical or force-majeure reasons.</p>

<p><strong>17. Governing Law & Jurisdiction</strong></p>
<p>This Offer Letter shall be governed by the laws of India.</p>
<p>Any disputes arising from this Offer Letter shall be subject to the exclusive jurisdiction of the competent courts at Hyderabad, Telangana, unless otherwise agreed in writing.</p>

<p><strong>18. Acceptance of Offer</strong></p>
<p>Please confirm your acceptance by signing and returning a copy of this Offer Letter within seven (7) days of the date hereof, failing which this offer shall automatically lapse unless extended by the Company in writing.</p>
<p>For any queries regarding this offer or the joining process, please contact hr@onebridgeinfotech.com or +91 93983 55196.</p>

<p><strong>Acceptance & Undertaking</strong></p>
<p>I acknowledge that I have read and understood the terms contained in this Offer Letter and accept the offer subject to the execution of the Company's Employment Agreement and other onboarding documents.</p>
<p>I specifically acknowledge Clauses 10, 11 and 16 above. I understand that any theft, leak, or misuse of the Company's or its clients' data, source code, ideas, or Confidential Information may result in immediate termination, civil liability, and criminal prosecution, including imprisonment, under applicable Indian law. I further understand and agree to the Early Exit, Continuity and Buyout terms, including Replacement Continuity & Knowledge Transfer, Buyout as determined by the Company, and consequences of unauthorized exit.</p>

<table width="100%" style="margin-top: 40px; font-size: 14px; border: none;">
  <tr>
    <td width="50%" align="left" valign="top">
      <p><strong>For the Candidate</strong></p><br/><br/>
      <p>Candidate Name: <strong>${text(d.candidateName, '______________________________')}</strong></p>
      <p>Signature: ________________________________</p>
      <p>Date: ${text(d.acceptanceDate, '____________________________________')}</p>
      <p>Place: ${text(d.acceptancePlace, '___________________________________')}</p>
    </td>
    <td width="50%" align="left" valign="top">
      <p><strong>For ${text(d.companyName, 'Onebridge Infotech Private Limited')}</strong></p><br/>
      ${signatorySigHTML}
      <p><strong>Authorized Signatory</strong></p>
      <p>Name: <strong>${text(d.signatoryName, 'Mr. Uday Kumar CH')}</strong></p>
      <p>Designation: <strong>${text(d.signatoryDesignation, 'Managing Director')}</strong></p>
      <p>Date: <strong>${text(d.offerDate, '____________________________________')}</strong></p><br/>
      ${companySealHTML}
    </td>
  </tr>
</table>

<p style="margin-top: 40px; page-break-before: always;"><strong>Encl.:</strong> Annexure A — Stipend & Benefits; Annexure B — Early Exit, Continuity & Buyout Process</p>

<!-- ANNEXURE A -->
<h3 style="text-align: center; text-decoration: underline;">ANNEXURE A — STIPEND & BENEFITS</h3>
<p style="text-align: center;"><em>Forms an integral part of the Internship Offer Letter</em></p>

<table border="1" cellpadding="8" cellspacing="0" width="100%" style="border-collapse: collapse; margin-top: 20px; font-size: 14px;">
  <tr>
    <td width="40%"><strong>Particulars</strong></td>
    <td width="60%"><strong>Details</strong></td>
  </tr>
  <tr>
    <td><strong>Engagement</strong></td>
    <td>Intern — Future Builders Program</td>
  </tr>
  <tr>
    <td><strong>Internship Duration</strong></td>
    <td>${text(d.internshipDuration, 'Six (6)')} months from the Joining Date</td>
  </tr>
  <tr>
    <td><strong>Monthly Stipend</strong></td>
    <td>₹ ${text(d.monthlyStipend, '____________')} (performance-based, reviewed periodically)</td>
  </tr>
  <tr>
    <td><strong>Payment Cycle</strong></td>
    <td>Monthly, on or before the 5th day of the following month</td>
  </tr>
  <tr>
    <td><strong>Work Mode</strong></td>
    <td>Office only — Hyderabad, Telangana (no work from home)</td>
  </tr>
  <tr>
    <td><strong>Working Days / Hours</strong></td>
    <td>As communicated by the Reporting Manager</td>
  </tr>
  <tr>
    <td><strong>Leave</strong></td>
    <td>As per the Company's internship leave policy</td>
  </tr>
  <tr>
    <td><strong>Statutory Deductions</strong></td>
    <td>As applicable under law (including TDS, if applicable)</td>
  </tr>
  <tr>
    <td><strong>Post-Internship</strong></td>
    <td>Regular employment may be offered at the Company's sole discretion; compensation for any such role will be communicated separately based on performance during the internship</td>
  </tr>
</table>

<p style="margin-top: 20px;"><strong>Notes:</strong></p>
<ul style="margin-top: 0; padding-left: 20px;">
  <li>The stipend is performance-based and does not constitute salary or wages for the purposes of permanent employment.</li>
  <li>Any full-time compensation offered after the internship will be based on performance during the program.</li>
  <li>This Annexure shall be read together with, and forms an integral part of, the Internship Offer Letter.</li>
</ul>

<table width="100%" style="margin-top: 40px; font-size: 14px; border: none;">
  <tr>
    <td width="50%" align="left" valign="top">
      <p><strong>For ${text(d.companyName, 'Onebridge Infotech Private Limited')}</strong></p><br/>
      ${signatorySigHTML}
      <p><strong>Authorized Signatory</strong></p>
      <p>Name: <strong>${text(d.signatoryName, 'Mr. Uday Kumar CH')}</strong></p>
      <p>Designation: <strong>${text(d.signatoryDesignation, 'Managing Director')}</strong></p>
      <p>Date: <strong>${text(d.offerDate, '____________________________________')}</strong></p>
    </td>
    <td width="50%" align="right" valign="bottom">
      ${companySealHTML}
    </td>
  </tr>
</table>

<!-- ANNEXURE B -->
<p style="page-break-before: always;"></p>
<h3 style="text-align: center; text-decoration: underline;">ANNEXURE B — EARLY EXIT, CONTINUITY & BUYOUT PROCESS</h3>
<p style="text-align: center;"><em>Forms an integral part of the Internship Offer Letter (Clause 16)</em></p>

<p>This Annexure sets out the process for early exit from the Company-sponsored internship / training program. No fixed monetary figure is stated herein. Any Training Investment Buyout shall be determined by the Company with reference to the training program cost and the period of the program completed.</p>

<p><strong>1. Track A — Replacement Continuity & Knowledge Transfer</strong></p>
<ul style="margin-top: 0; padding-left: 20px;">
  <li>Submit written resignation to HR (hr@onebridgeinfotech.com).</li>
  <li>Remain engaged for a minimum of two (2) months and a maximum of three (3) months from the resignation date, or until a replacement joins and knowledge transfer is completed, whichever is earlier within that window.</li>
  <li>Complete knowledge transfer covering assigned work, tools/processes, pending tasks, project context, and a written handover note to the replacement or reporting manager.</li>
  <li>Obtain written confirmation of KT completion from the reporting manager.</li>
  <li>Complete clearance (return of Company property, access revocation, and exit formalities).</li>
  <li>Upon clearance, the Company shall process relieving formalities and issue the internship certificate.</li>
</ul>

<p><strong>2. Track B — Buyout</strong></p>
<ul style="margin-top: 0; padding-left: 20px;">
  <li>Submit written resignation electing the Buyout track.</li>
  <li>The Company shall communicate in writing the Training Investment Buyout amount determined with reference to the training program cost and the period of the program completed.</li>
  <li>Pay/settle the Buyout amount as directed by the Company and complete a written handover.</li>
  <li>Return Company property and access; complete clearance.</li>
  <li>Upon settlement and clearance, the Company shall process relieving formalities and issue the internship certificate.</li>
</ul>

<p><strong>3. Track C — Unauthorized Exit / Non-Cooperation</strong></p>
<ul style="margin-top: 0; padding-left: 20px;">
  <li>Absconding, abandonment, resignation without electing Track A or B, or refusal of knowledge transfer / handover shall be treated as breach.</li>
  <li>The Company may recover the applicable Training Investment Buyout on the same basis as Track B, and notice pay in lieu if fifteen (15) days' notice is not served.</li>
  <li>Relieving and experience documentation may be withheld until settlement and clearance.</li>
  <li>Confidentiality, data protection, and intellectual property remedies remain available to the Company.</li>
  <li>Upon settlement and clearance, the Company may process relieving formalities.</li>
</ul>

<p><strong>4. General</strong></p>
<ul style="margin-top: 0; padding-left: 20px;">
  <li>Fifteen (15) days' written notice under Clause 15 continues to apply unless otherwise accepted by the Company in writing.</li>
  <li>Confidentiality and intellectual property obligations survive exit under all tracks.</li>
  <li>This Annexure does not apply where the Company terminates without misconduct, or where exit is approved for documented medical or force-majeure reasons.</li>
  <li>This Annexure shall be read together with, and forms an integral part of, the Internship Offer Letter.</li>
</ul>

<table width="100%" style="margin-top: 40px; font-size: 14px; border: none;">
  <tr>
    <td width="50%" align="left" valign="top">
      <p><strong>For ${text(d.companyName, 'Onebridge Infotech Private Limited')}</strong></p><br/>
      ${signatorySigHTML}
      <p><strong>Authorized Signatory</strong></p>
      <p>Name: <strong>${text(d.signatoryName, 'Mr. Uday Kumar CH')}</strong></p>
      <p>Designation: <strong>${text(d.signatoryDesignation, 'Managing Director')}</strong></p>
      <p>Date: <strong>${text(d.offerDate, '____________________________________')}</strong></p>
    </td>
    <td width="50%" align="right" valign="bottom">
      ${companySealHTML}
    </td>
  </tr>
</table>

<div style="border-top: 2px dashed #ccc; margin-top: 40px; padding-top: 20px;">
  <p><strong>Intern Acknowledgement (Annexure B):</strong></p>
  <p>I have read and understood Annexure B and agree that early exit shall be only through Track A, Track B, or as treated under Track C, and that any Buyout amount shall be as determined by the Company with reference to the training program cost and period completed.</p>
  
  <p style="margin-top: 20px;">Intern Name: <strong>${text(d.candidateName, '________________________________________')}</strong></p>
  <p>Signature: ________________________________________</p>
  <p>Date: ________________________________________</p>
</div>

</div>
`;
};
