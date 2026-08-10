import nodemailer from 'nodemailer';

import path from 'path';
import fs from 'fs';

const LOGO_URL = 'cid:onebridge-logo';
const PRIMARY_COLOR = '#f97316';
const SECONDARY_COLOR = '#1f2937';
const SUCCESS_COLOR = '#16a34a';
const ERROR_COLOR = '#dc2626';
const WARNING_COLOR = '#d97706';
const INFO_COLOR = '#2563eb';

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private logoPath(): string | null {
    const candidates = [
      path.resolve(__dirname, '../../../client/public/image.png'),
      path.resolve(__dirname, '../../../public/image.png'),
      path.resolve(process.cwd(), 'public/image.png'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return p;
      } catch {
        // ignore
      }
    }
    return null;
  }

  private async getTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) return this.transporter;

    const host = process.env.EMAIL_HOST;
    const port = parseInt(process.env.EMAIL_PORT || '587');
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (host && host !== 'smtp.ethereal.email' && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      console.log('Generating Ethereal SMTP test credentials...');
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    return this.transporter;
  }

  public async sendMail(to: string, subject: string, html: string, attachments?: any[]) {
    try {
      const transporter = await this.getTransporter();
      const logoPath = this.logoPath();
      const mailOptions = {
        from: '"OneBridge HR System" <hr@onebridgeinfotech.com>',
        to,
        subject,
        html,
        attachments: [
          ...(attachments || []),
          ...(logoPath
            ? [
                {
                  filename: 'logo.png',
                  path: logoPath,
                  cid: 'onebridge-logo',
                },
              ]
            : []),
        ],
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent: ${info.messageId}`);

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`Preview URL: ${previewUrl}`);
      }
      return info;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  private renderBrandedEmail(title: string, bodyHtml: string): string {
    const logoHtml = this.logoPath()
      ? `<img src="${LOGO_URL}" alt="OneBridge" width="52" height="52" style="display:block; border-radius:10px; background-color:#ffffff; padding:4px;" />`
      : `<div style="width:52px; height:52px; border-radius:10px; background-color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:800; color:${PRIMARY_COLOR};">OB</div>`;
    return `
      <!DOCTYPE html>
      <html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
      <head>
        <meta charset="UTF-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="format-detection" content="date=no" />
        <meta name="format-detection" content="address=no" />
        <meta name="format-detection" content="email=no" />
        <title>${title}</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f3f4f6; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6; padding:20px 0;">
          <tr>
            <td align="center" style="padding:0;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                <tr>
                  <td style="background: linear-gradient(135deg, ${PRIMARY_COLOR} 0%, #ea580c 100%); padding:24px 32px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="60" valign="middle" style="padding-right:16px;">
                          ${logoHtml}
                        </td>
                        <td valign="middle">
                          <div style="color:#ffffff; font-size:22px; font-weight:700; letter-spacing:-0.3px; margin:0; line-height:1.2;">OneBridge Infotech</div>
                          <div style="color:rgba(255,255,255,0.85); font-size:13px; margin-top:4px;">Human Resources Management System</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    ${bodyHtml}
                  </td>
                </tr>
                <tr>
                  <td style="background-color:#111827; padding:28px 32px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding-bottom:16px;">
                          <div style="color:${PRIMARY_COLOR}; font-size:15px; font-weight:700; margin-bottom:6px;">OneBridge Infotech Pvt. Ltd.</div>
                          <div style="color:#9ca3af; font-size:12px; line-height:1.7;">
                            📧 <a href="mailto:info@onebridgeinfotech.com" style="color:#9ca3af; text-decoration:none;">info@onebridgeinfotech.com</a><br/>
                            📞 +91 9398355196<br/><br/>
                            <strong>Corporate Office</strong><br/>
                            202, Sathyabama Complex<br/>
                            Bhagya Nagar Colony<br/>
                            KPHB<br/>
                            Hyderabad, Telangana – 500072
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  public async sendPayslipEmail(email: string, employeeName: string, monthName: string, pdfBuffer: Buffer) {
    const subject = `Your Payslip for ${monthName}`;
    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <h2 style="color:${SECONDARY_COLOR}; font-size:20px; font-weight:700; margin:0 0 8px 0;">Payslip Issued</h2>
        <div style="height:3px; width:60px; background-color:${PRIMARY_COLOR}; border-radius:2px;"></div>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:15px; line-height:1.7; margin:0 0 16px 0;">Dear ${employeeName},</p>
      <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 20px 0;">
        Please find attached your payslip for the month of <strong style="color:${PRIMARY_COLOR};">${monthName}</strong>.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fff7ed; border-left:4px solid ${PRIMARY_COLOR}; border-radius:6px; padding:16px; margin-bottom:24px;">
        <tr>
          <td style="padding:4px 12px;">
            <div style="color:#9a3412; font-size:13px; font-weight:600;">Important Notice</div>
            <div style="color:#78350f; font-size:12px; line-height:1.6; margin-top:4px;">
              This is an automated system-generated email. If you have any discrepancies, please reach out to the HR department within 5 working days.
            </div>
          </td>
        </tr>
      </table>
      <p style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.7; margin:0;">Best regards,</p>

    `;
    const html = this.renderBrandedEmail(subject, bodyHtml);

    return this.sendMail(email, subject, html, [
      {
        filename: `Payslip-${employeeName.replace(/\s+/g, '_')}-${monthName}.pdf`,
        content: pdfBuffer,
      },
    ]);
  }

  public async sendOfferLetterEmail(to: string, candidateName: string, pdfBuffer?: Buffer) {
    const subject = `Welcome to OneBridge Infotech, ${candidateName}!`;
    const attachments = pdfBuffer ? [{
      filename: `Offer_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`,
      content: pdfBuffer,
    }] : undefined;

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <h2 style="color:${SECONDARY_COLOR}; font-size:20px; font-weight:700; margin:0 0 8px 0;">Congratulations, ${candidateName}! 🎉</h2>
        <div style="height:3px; width:60px; background-color:${PRIMARY_COLOR}; border-radius:2px;"></div>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:15px; line-height:1.7; margin:0 0 20px 0;">
        On behalf of the entire team at <strong style="color:${PRIMARY_COLOR};">OneBridge Infotech</strong>, it is with great pleasure that we extend this offer to join our growing family.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border-radius:10px; padding:24px; margin-bottom:24px;">
        <tr>
          <td align="center">
            <div style="font-size:36px; margin-bottom:10px;">🚀</div>
            <div style="color:${PRIMARY_COLOR}; font-size:18px; font-weight:700; margin-bottom:6px;">Your Journey Begins Here</div>
            <div style="color:#78350f; font-size:13px; line-height:1.6;">We are excited to welcome you and witness the incredible work you will do.</div>
          </td>
        </tr>
      </table>
      <div style="color:#4b5563; font-size:14px; line-height:1.7; margin-bottom:20px;">
        <p style="margin:0 0 12px 0;">Please find your detailed Offer Letter attached with this email. Kindly review the terms and conditions thoroughly.</p>
        <p style="margin:0;">Should you have any questions or need further clarification, feel free to reach out to the HR team at any time.</p>
      </div>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background-color:${PRIMARY_COLOR}; border-radius:8px; padding:14px 28px;">
            <a href="mailto:hr@onebridgeinfotech.com" style="color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; display:inline-block;">Contact HR Team</a>
          </td>
        </tr>
      </table>
      <p style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.7; margin:0;">Welcome aboard!</p>

    `;

    const html = this.renderBrandedEmail(subject, bodyHtml);
    return this.sendMail(to, subject, html, attachments);
  }

  public async sendWelcomeCredentialsEmail(
    to: string,
    employeeName: string,
    portalUrl: string,
    username: string,
    password: string,
    employeeId: string,
    offerPdfBuffer?: Buffer
  ) {
    const subject = 'Welcome to OneBridge Infotech Pvt. Ltd.';
    const attachments = offerPdfBuffer ? [{
      filename: `Welcome_Package_${employeeId}.pdf`,
      content: offerPdfBuffer,
    }] : undefined;

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <h2 style="color:${SECONDARY_COLOR}; font-size:20px; font-weight:700; margin:0 0 8px 0;">Welcome to OneBridge, ${employeeName}! 👋</h2>
        <div style="height:3px; width:60px; background-color:${PRIMARY_COLOR}; border-radius:2px;"></div>
      </div>
      <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 24px 0;">
        Your employee account has been created. Below are your credentials to access the OneBridge Employee Portal.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; margin-bottom:20px;">
        <tr>
          <td colspan="2" style="background-color:${PRIMARY_COLOR}; padding:14px 20px;">
            <div style="color:#ffffff; font-size:14px; font-weight:700;">🔐 Account Credentials</div>
          </td>
        </tr>
        <tr style="background-color:#fafafa;">
          <td style="padding:14px 20px; border-bottom:1px solid #f0f0f0; width:140px;">
            <div style="color:#6b7280; font-size:12px; font-weight:600;">Employee ID</div>
          </td>
          <td style="padding:14px 20px; border-bottom:1px solid #f0f0f0;">
            <div style="color:${SECONDARY_COLOR}; font-size:14px; font-weight:700; font-family:'Courier New', monospace;">${employeeId}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 20px; border-bottom:1px solid #f0f0f0;">
            <div style="color:#6b7280; font-size:12px; font-weight:600;">Portal URL</div>
          </td>
          <td style="padding:14px 20px; border-bottom:1px solid #f0f0f0;">
            <a href="${portalUrl}" style="color:${PRIMARY_COLOR}; font-size:14px; font-weight:600; text-decoration:underline;">${portalUrl}</a>
          </td>
        </tr>
        <tr style="background-color:#fafafa;">
          <td style="padding:14px 20px; border-bottom:1px solid #f0f0f0;">
            <div style="color:#6b7280; font-size:12px; font-weight:600;">Username / Email</div>
          </td>
          <td style="padding:14px 20px; border-bottom:1px solid #f0f0f0;">
            <div style="color:${SECONDARY_COLOR}; font-size:14px;">${username}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 20px;">
            <div style="color:#6b7280; font-size:12px; font-weight:600;">Temporary Password</div>
          </td>
          <td style="padding:14px 20px;">
            <div style="background-color:#fef3c7; color:#92400e; font-size:14px; font-weight:700; font-family:'Courier New', monospace; padding:8px 12px; border-radius:6px; display:inline-block;">${password}</div>
          </td>
        </tr>
      </table>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fef2f2; border-left:4px solid ${ERROR_COLOR}; border-radius:6px; padding:16px; margin-bottom:24px;">
        <tr>
          <td style="padding:0 4px 6px 0; width:24px; vertical-align:top;">
            <div style="font-size:18px;">⚠️</div>
          </td>
          <td style="padding:0;">
            <div style="color:${ERROR_COLOR}; font-size:13px; font-weight:700; margin-bottom:4px;">Security Notice</div>
            <ul style="color:#7f1d1d; font-size:12px; line-height:1.7; margin:0; padding-left:18px;">
              <li>Change your password immediately upon first login</li>
              <li>Do not share your credentials with anyone</li>
              <li>Enable 2FA for enhanced security</li>
              <li>Report any suspicious activity to IT Support</li>
            </ul>
          </td>
        </tr>
      </table>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background-color:${PRIMARY_COLOR}; border-radius:8px; padding:14px 28px;">
            <a href="${portalUrl}" style="color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; display:inline-block;">Access Employee Portal</a>
          </td>
        </tr>
      </table>
      <p style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.7; margin:0;">Welcome once again!</p>
    `;

    const html = this.renderBrandedEmail(subject, bodyHtml);
    return this.sendMail(to, subject, html, attachments);
  }

  public async sendTaskAssignmentEmail(
    to: string,
    employeeName: string,
    task: {
      title: string;
      description: string;
      priority: string;
      deadline: string;
      timeline?: string;
      attachments?: string[];
      assignedByName: string;
      projectName?: string;
    }
  ) {
    const subject = `New Task Assigned: ${task.title}`;
    const priorityStyles: Record<string, { bg: string; text: string; label: string }> = {
      LOW: { bg: '#dcfce7', text: '#166534', label: 'LOW' },
      MEDIUM: { bg: '#dbeafe', text: '#1e40af', label: 'MEDIUM' },
      HIGH: { bg: '#fef3c7', text: '#92400e', label: 'HIGH' },
      CRITICAL: { bg: '#fecaca', text: '#991b1b', label: 'CRITICAL' },
    };
    const pStyle = priorityStyles[task.priority] || priorityStyles.MEDIUM;

    const attachmentsHtml = task.attachments && task.attachments.length > 0
      ? `
        <tr>
          <td colspan="2" style="padding:14px 20px; border-top:1px solid #f0f0f0;">
            <div style="color:#6b7280; font-size:12px; font-weight:600; margin-bottom:8px;">📎 Attachments (${task.attachments.length})</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${task.attachments.map(a => `
                <div style="background-color:#f3f4f6; border-radius:6px; padding:6px 12px; color:#4b5563; font-size:12px; display:inline-flex; align-items:center; margin-right:8px; margin-bottom:4px;">
                  📄 ${a.split('/').pop() || a}
                </div>
              `).join('')}
            </div>
          </td>
        </tr>
      ` : '';

    const timelineHtml = task.timeline
      ? `
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f9ff; border-radius:8px; padding:16px; margin-top:20px; margin-bottom:20px;">
          <tr>
            <td style="width:32px; vertical-align:top; padding-right:12px;">
              <div style="font-size:20px;">📅</div>
            </td>
            <td>
              <div style="color:#0c4a6e; font-size:13px; font-weight:700; margin-bottom:4px;">Timeline Overview</div>
              <div style="color:#075985; font-size:13px; line-height:1.6;">${task.timeline}</div>
            </td>
          </tr>
        </table>
      ` : '';

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <h2 style="color:${SECONDARY_COLOR}; font-size:20px; font-weight:700; margin:0;">New Task Assigned</h2>
          <span style="background-color:${pStyle.bg}; color:${pStyle.text}; font-size:11px; font-weight:800; padding:6px 14px; border-radius:20px; letter-spacing:0.5px; display:inline-block;">${pStyle.label} PRIORITY</span>
        </div>
        <div style="height:3px; width:60px; background-color:${PRIMARY_COLOR}; border-radius:2px;"></div>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:15px; line-height:1.7; margin:0 0 20px 0;">Hi ${employeeName},</p>
      <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 24px 0;">
        You have been assigned a new task by <strong style="color:${PRIMARY_COLOR};">${task.assignedByName}</strong>.
        Please review the details below and start working on it at your earliest.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; margin-bottom:4px;">
        <tr>
          <td colspan="2" style="background:linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); padding:16px 20px; border-bottom:1px solid #fed7aa;">
            <div style="color:${SECONDARY_COLOR}; font-size:16px; font-weight:700;">${task.title}</div>
            ${task.projectName ? `<div style="color:#c2410c; font-size:12px; font-weight:600; margin-top:6px;">📁 Project: ${task.projectName}</div>` : ''}
          </td>
        </tr>
        <tr style="background-color:#fafafa;">
          <td style="padding:14px 20px; border-bottom:1px solid #f0f0f0; width:130px;">
            <div style="color:#6b7280; font-size:12px; font-weight:600;">🎯 Deadline</div>
          </td>
          <td style="padding:14px 20px; border-bottom:1px solid #f0f0f0;">
            <div style="color:${SECONDARY_COLOR}; font-size:14px; font-weight:600;">${task.deadline}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding:14px 20px; border-bottom:1px solid #f0f0f0;">
            <div style="color:#6b7280; font-size:12px; font-weight:600; margin-bottom:8px;">📝 Description</div>
            <div style="color:#4b5563; font-size:13px; line-height:1.7; white-space:pre-wrap;">${task.description}</div>
          </td>
        </tr>
        ${attachmentsHtml}
      </table>
      ${timelineHtml}
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:${PRIMARY_COLOR}; border-radius:8px; padding:14px 36px;">
                  <a href="#" style="color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; display:inline-block;">✅ View & Start Task</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <p style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.7; margin:0;">Best,</p>
    `;

    const html = this.renderBrandedEmail(subject, bodyHtml);
    return this.sendMail(to, subject, html);
  }

  public async sendLeaveApprovalEmail(to: string, employeeName: string, leaveDetails: any, approvedByHr: boolean) {
    const subject = `Leave Approved - ${leaveDetails.leaveType || 'Leave Request'}`;
    const approverLabel = approvedByHr ? 'HR Department' : 'Reporting Manager';

    const startDate = new Date(leaveDetails.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const endDate = new Date(leaveDetails.endDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <h2 style="color:${SECONDARY_COLOR}; font-size:20px; font-weight:700; margin:0 0 8px 0;">Leave Request Approved ✅</h2>
        <div style="height:3px; width:60px; background-color:${SUCCESS_COLOR}; border-radius:2px;"></div>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:15px; line-height:1.7; margin:0 0 20px 0;">Dear ${employeeName},</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius:12px; padding:24px; margin-bottom:24px;">
        <tr>
          <td align="center" style="padding-bottom:16px;">
            <div style="width:64px; height:64px; background-color:${SUCCESS_COLOR}; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 12px auto;">
              <div style="color:#ffffff; font-size:32px; font-weight:800;">✓</div>
            </div>
            <div style="color:${SUCCESS_COLOR}; font-size:18px; font-weight:700;">Approved by ${approverLabel}</div>
            <div style="color:#166534; font-size:13px; line-height:1.6; margin-top:6px;">Your leave request has been reviewed and approved. Enjoy your time off!</div>
          </td>
        </tr>
      </table>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #bbf7d0; border-radius:10px; overflow:hidden; margin-bottom:24px;">
        <tr>
          <td colspan="2" style="background-color:${SUCCESS_COLOR}; padding:14px 20px;">
            <div style="color:#ffffff; font-size:14px; font-weight:700;">📋 Leave Details</div>
          </td>
        </tr>
        <tr style="background-color:#fafafa;">
          <td style="padding:14px 20px; border-bottom:1px solid #dcfce7; width:140px;">
            <div style="color:#6b7280; font-size:12px; font-weight:600;">Leave Type</div>
          </td>
          <td style="padding:14px 20px; border-bottom:1px solid #dcfce7;">
            <div style="color:${SECONDARY_COLOR}; font-size:14px; font-weight:600;">${leaveDetails.leaveType || 'N/A'}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 20px; border-bottom:1px solid #dcfce7;">
            <div style="color:#6b7280; font-size:12px; font-weight:600;">Start Date</div>
          </td>
          <td style="padding:14px 20px; border-bottom:1px solid #dcfce7;">
            <div style="color:${SECONDARY_COLOR}; font-size:14px;">${startDate}</div>
          </td>
        </tr>
        <tr style="background-color:#fafafa;">
          <td style="padding:14px 20px; border-bottom:1px solid #dcfce7;">
            <div style="color:#6b7280; font-size:12px; font-weight:600;">End Date</div>
          </td>
          <td style="padding:14px 20px; border-bottom:1px solid #dcfce7;">
            <div style="color:${SECONDARY_COLOR}; font-size:14px;">${endDate}</div>
          </td>
        </tr>
        ${leaveDetails.reason ? `
          <tr>
            <td colspan="2" style="padding:14px 20px;">
              <div style="color:#6b7280; font-size:12px; font-weight:600; margin-bottom:6px;">Reason</div>
              <div style="color:#4b5563; font-size:13px; line-height:1.6;">${leaveDetails.reason}</div>
            </td>
          </tr>
        ` : ''}
      </table>
      <div style="color:#4b5563; font-size:14px; line-height:1.7; margin-bottom:20px;">
        <p style="margin:0 0 12px 0;">Please ensure all pending tasks are properly handed over or completed before your leave starts.</p>
        <p style="margin:0;">For any emergencies during your leave, contact your Reporting Manager or the HR Department.</p>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.7; margin:0;">Best regards,</p>

    `;

    const html = this.renderBrandedEmail(subject, bodyHtml);
    return this.sendMail(to, subject, html);
  }

  public async sendLeaveRejectionEmail(to: string, employeeName: string, leaveDetails: any, reason: string, rejectedBy: string) {
    const subject = `Leave Request Rejected - ${leaveDetails.leaveType || 'Leave Request'}`;
    const startDate = new Date(leaveDetails.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const endDate = new Date(leaveDetails.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <h2 style="color:${SECONDARY_COLOR}; font-size:20px; font-weight:700; margin:0 0 8px 0;">Leave Request Not Approved</h2>
        <div style="height:3px; width:60px; background-color:${ERROR_COLOR}; border-radius:2px;"></div>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:15px; line-height:1.7; margin:0 0 20px 0;">Dear ${employeeName},</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius:12px; padding:24px; margin-bottom:24px;">
        <tr>
          <td align="center" style="padding-bottom:16px;">
            <div style="width:64px; height:64px; background-color:${ERROR_COLOR}; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 12px auto;">
              <div style="color:#ffffff; font-size:32px; font-weight:800;">!</div>
            </div>
            <div style="color:${ERROR_COLOR}; font-size:18px; font-weight:700;">Rejected by ${rejectedBy}</div>
            <div style="color:#991b1b; font-size:13px; line-height:1.6; margin-top:6px;">Unfortunately, your leave request could not be approved at this time.</div>
          </td>
        </tr>
      </table>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #fecaca; border-radius:10px; overflow:hidden; margin-bottom:20px;">
        <tr>
          <td colspan="2" style="background-color:${ERROR_COLOR}; padding:14px 20px;">
            <div style="color:#ffffff; font-size:14px; font-weight:700;">📋 Request Summary</div>
          </td>
        </tr>
        <tr style="background-color:#fafafa;">
          <td style="padding:12px 20px; border-bottom:1px solid #fecaca; width:130px;">
            <div style="color:#6b7280; font-size:12px; font-weight:600;">Leave Type</div>
          </td>
          <td style="padding:12px 20px; border-bottom:1px solid #fecaca;">
            <div style="color:${SECONDARY_COLOR}; font-size:14px; font-weight:600;">${leaveDetails.leaveType || 'N/A'}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 20px; border-bottom:1px solid #fecaca;">
            <div style="color:#6b7280; font-size:12px; font-weight:600;">Duration</div>
          </td>
          <td style="padding:12px 20px; border-bottom:1px solid #fecaca;">
            <div style="color:${SECONDARY_COLOR}; font-size:14px;">${startDate} to ${endDate}</div>
          </td>
        </tr>
      </table>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fff1f2; border-left:4px solid ${ERROR_COLOR}; border-radius:6px; padding:16px; margin-bottom:24px;">
        <tr>
          <td style="width:28px; vertical-align:top; padding-right:10px;">
            <div style="font-size:18px;">📝</div>
          </td>
          <td>
            <div style="color:${ERROR_COLOR}; font-size:13px; font-weight:700; margin-bottom:6px;">Rejection Reason</div>
            <div style="color:#881337; font-size:13px; line-height:1.7;">${reason}</div>
          </td>
        </tr>
      </table>
      <div style="color:#4b5563; font-size:14px; line-height:1.7; margin-bottom:20px;">
        <p style="margin:0;">If you have any questions or would like to discuss alternative dates, please reach out to ${rejectedBy} or the HR department.</p>
      </div>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background-color:${SECONDARY_COLOR}; border-radius:8px; padding:12px 24px;">
            <a href="mailto:hr@onebridgeinfotech.com" style="color:#ffffff; font-size:13px; font-weight:600; text-decoration:none; display:inline-block;">Contact HR</a>
          </td>
        </tr>
      </table>
      <p style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.7; margin:0;">Regards,</p>
    `;

    const html = this.renderBrandedEmail(subject, bodyHtml);
    return this.sendMail(to, subject, html);
  }

  public async sendAttendanceReminderEmail(to: string, employeeName: string, date: string, checkInCode: string) {
    const subject = `Daily Attendance Reminder - ${date}`;
    const formattedDate = new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <h2 style="color:${SECONDARY_COLOR}; font-size:20px; font-weight:700; margin:0 0 8px 0;">⏰ Daily Attendance Reminder</h2>
        <div style="height:3px; width:60px; background-color:${PRIMARY_COLOR}; border-radius:2px;"></div>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:15px; line-height:1.7; margin:0 0 20px 0;">Good morning, ${employeeName}!</p>
      <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 24px 0;">
        Don't forget to mark your attendance for today. Use the check-in code below to record your presence.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
        <tr>
          <td align="center" style="padding-bottom:12px;">
            <div style="color:#6b7280; font-size:12px; font-weight:600; letter-spacing:1px; margin-bottom:10px;">📅 ${formattedDate.toUpperCase()}</div>
          </td>
        </tr>
        <tr>
          <td align="center">
            <div style="display:inline-block; background:linear-gradient(135deg, ${PRIMARY_COLOR} 0%, #ea580c 100%); border-radius:14px; padding:20px 40px; box-shadow:0 6px 20px rgba(249,115,22,0.35);">
              <div style="color:#ffffff; font-size:13px; font-weight:600; letter-spacing:2px; opacity:0.9; text-align:center; margin-bottom:8px;">YOUR CHECK-IN CODE</div>
              <div style="color:#ffffff; font-size:36px; font-weight:800; letter-spacing:8px; font-family:'Courier New', monospace; text-align:center;">${checkInCode}</div>
            </div>
          </td>
        </tr>
      </table>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fff7ed; border-left:4px solid ${PRIMARY_COLOR}; border-radius:6px; padding:16px; margin-top:24px; margin-bottom:24px;">
        <tr>
          <td style="width:28px; vertical-align:top; padding-right:10px;">
            <div style="font-size:18px;">💡</div>
          </td>
          <td>
            <div style="color:#9a3412; font-size:13px; font-weight:700; margin-bottom:4px;">Important Reminders</div>
            <ul style="color:#78350f; font-size:12px; line-height:1.8; margin:0; padding-left:18px;">
              <li>Check-in code is valid only for today's date</li>
              <li>Standard check-in time: 9:30 AM</li>
              <li>Use the employee portal or mobile app to check in</li>
              <li>Contact HR if you face any issues marking attendance</li>
            </ul>
          </td>
        </tr>
      </table>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background-color:${PRIMARY_COLOR}; border-radius:8px; padding:14px 28px;">
            <a href="#" style="color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; display:inline-block;">🚀 Mark Attendance Now</a>
          </td>
        </tr>
      </table>
      <p style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.7; margin:0;">Have a productive day!</p>
      <p style="color:${PRIMARY_COLOR}; font-size:15px; font-weight:700; margin:8px 0 0 0;">OneBridge Infotech Team</p>
    `;

    const html = this.renderBrandedEmail(subject, bodyHtml);
    return this.sendMail(to, subject, html);
  }

  public async sendEmployeeAnniversaryEmail(to: string, employeeName: string, years: number) {
    const subject = `🎉 Happy Work Anniversary, ${employeeName}! - ${years} Amazing Year${years !== 1 ? 's' : ''}`;

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <div style="text-align:center; margin-bottom:12px;">
          <div style="font-size:28px; letter-spacing:6px;">🎊 🎉 🎊</div>
        </div>
        <h2 style="color:${SECONDARY_COLOR}; font-size:22px; font-weight:700; margin:0 0 8px 0; text-align:center;">Happy Work Anniversary!</h2>
        <div style="height:3px; width:80px; background:linear-gradient(90deg, ${PRIMARY_COLOR}, #fbbf24); border-radius:2px; margin:0 auto;"></div>
      </div>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:linear-gradient(135deg, ${PRIMARY_COLOR} 0%, #ea580c 50%, #fbbf24 100%); border-radius:14px; padding:32px 24px; margin-bottom:24px;">
        <tr>
          <td align="center">
            <div style="font-size:52px; margin-bottom:14px;">🏆</div>
            <div style="color:#ffffff; font-size:42px; font-weight:800; letter-spacing:-1px; margin-bottom:8px;">${years}</div>
            <div style="color:rgba(255,255,255,0.92); font-size:16px; font-weight:600; letter-spacing:1px;">REMARKABLE YEAR${years !== 1 ? 'S' : ''} WITH ONEBRIDGE</div>
          </td>
        </tr>
      </table>
      <div style="text-align:center; margin-bottom:20px;">
        <div style="color:#fbbf24; font-size:18px; letter-spacing:3px; margin-bottom:6px;">✨ ✨ ✨</div>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:15px; line-height:1.8; margin:0 0 16px 0; text-align:center;">Dear ${employeeName},</p>
      <p style="color:#4b5563; font-size:14px; line-height:1.8; margin:0 0 24px 0; text-align:center;">
        Today marks <strong style="color:${PRIMARY_COLOR};">${years} incredible year${years !== 1 ? 's' : ''}</strong> of your journey with OneBridge Infotech.
        Your dedication, hard work, and contributions have been invaluable to our growth and success.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fff7ed; border-radius:10px; padding:20px; margin-bottom:24px;">
        <tr>
          <td align="center">
            <div style="color:#9a3412; font-size:13px; font-weight:600; margin-bottom:8px;">🌟 A Note from the Team 🌟</div>
            <div style="color:#78350f; font-size:13px; line-height:1.7; font-style:italic;">
              "Thank you for ${years} year${years !== 1 ? 's' : ''} of dedication, innovation, and unwavering commitment.
              You are an integral part of the OneBridge family, and we look forward to many more milestones together!"
            </div>
          </td>
        </tr>
      </table>
      <div style="text-align:center; margin-bottom:8px;">
        <div style="color:#fbbf24; font-size:16px; letter-spacing:4px;">🎉 🎈 🎊 🎁 🎉</div>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.7; margin:0; text-align:center;">With heartfelt appreciation,</p>
      <p style="color:${PRIMARY_COLOR}; font-size:15px; font-weight:700; margin:10px 0 0 0; text-align:center;">The Entire OneBridge Infotech Team</p>
    `;

    const html = this.renderBrandedEmail(subject, bodyHtml);
    return this.sendMail(to, subject, html);
  }

  public async sendBirthdayWishesEmail(to: string, employeeName: string, date: string) {
    const subject = `🎂 Happy Birthday, ${employeeName}! 🎉`;
    const formattedDate = new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <div style="text-align:center; margin-bottom:12px;">
          <div style="font-size:30px; letter-spacing:6px;">🎂 🎈 🎁 🎉 🎊</div>
        </div>
        <h2 style="color:${SECONDARY_COLOR}; font-size:22px; font-weight:700; margin:0 0 8px 0; text-align:center;">Happy Birthday, ${employeeName}!</h2>
        <div style="height:3px; width:80px; background:linear-gradient(90deg, ${PRIMARY_COLOR}, #fbbf24); border-radius:2px; margin:0 auto;"></div>
      </div>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:linear-gradient(135deg, #fff7ed 0%, #ffedd5 30%, #fef3c7 70%, #fde68a 100%); border-radius:14px; padding:36px 24px; margin-bottom:24px;">
        <tr>
          <td align="center">
            <div style="font-size:72px; margin-bottom:16px;">🎂</div>
            <div style="color:${PRIMARY_COLOR}; font-size:24px; font-weight:800; letter-spacing:-0.3px; margin-bottom:10px;">Wishing You a Fantastic Birthday!</div>
            <div style="color:#92400e; font-size:14px; line-height:1.7;">${formattedDate}</div>
          </td>
        </tr>
      </table>
      <div style="text-align:center; margin-bottom:18px;">
        <div style="color:#fbbf24; font-size:18px; letter-spacing:3px;">🎊 🎉 🎊</div>
      </div>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fffbeb; border-radius:10px; padding:24px 20px; margin-bottom:24px;">
        <tr>
          <td align="center" style="padding-bottom:12px;">
            <div style="font-size:22px;">💝</div>
          </td>
        </tr>
        <tr>
          <td align="center">
            <div style="color:#92400e; font-size:15px; font-weight:700; margin-bottom:10px;">Birthday Wishes from OneBridge</div>
            <div style="color:#78350f; font-size:14px; line-height:1.9; font-style:italic;">
              May this special day bring you endless joy, laughter, and unforgettable moments.<br/>
              May the year ahead be filled with success, good health, and all your dreams coming true.<br/>
              Thank you for being such an amazing part of the OneBridge family! 🎉
            </div>
          </td>
        </tr>
      </table>
      <div style="text-align:center; margin-bottom:10px;">
        <div style="color:#fbbf24; font-size:18px; letter-spacing:4px;">🎁 🎂 🎈 🎉 🎊</div>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.7; margin:0; text-align:center;">With warmest wishes,</p>
      <p style="color:${PRIMARY_COLOR}; font-size:15px; font-weight:700; margin:10px 0 0 0; text-align:center;">All of Us at OneBridge Infotech 💙</p>
    `;

    const html = this.renderBrandedEmail(subject, bodyHtml);
    return this.sendMail(to, subject, html);
  }

  public async sendPasswordResetEmail(to: string, employeeName: string, resetUrl: string, expiresHours: number) {
    const subject = `Password Reset Request - OneBridge Portal`;

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <h2 style="color:${SECONDARY_COLOR}; font-size:20px; font-weight:700; margin:0 0 8px 0;">🔐 Password Reset Request</h2>
        <div style="height:3px; width:60px; background-color:${INFO_COLOR}; border-radius:2px;"></div>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:15px; line-height:1.7; margin:0 0 16px 0;">Dear ${employeeName},</p>
      <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 24px 0;">
        We received a request to reset the password for your OneBridge Employee Portal account.
        If this was you, click the button below to set a new password.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(135deg, ${INFO_COLOR} 0%, #1d4ed8 100%); border-radius:8px; padding:16px 36px; box-shadow:0 4px 14px rgba(37,99,235,0.3);">
                  <a href="${resetUrl}" style="color:#ffffff; font-size:14px; font-weight:700; text-decoration:none; display:inline-block; letter-spacing:0.3px;">🔑 Reset My Password</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#eff6ff; border-left:4px solid ${INFO_COLOR}; border-radius:6px; padding:16px; margin-bottom:20px;">
        <tr>
          <td style="width:28px; vertical-align:top; padding-right:10px;">
            <div style="font-size:18px;">⏱️</div>
          </td>
          <td>
            <div style="color:#1e40af; font-size:13px; font-weight:700; margin-bottom:4px;">Link Expires in ${expiresHours} Hour${expiresHours !== 1 ? 's' : ''}</div>
            <div style="color:#1e3a8a; font-size:12px; line-height:1.6;">This password reset link is only valid for the next ${expiresHours} hour${expiresHours !== 1 ? 's' : ''}. Please complete the reset as soon as possible.</div>
          </td>
        </tr>
      </table>
      <div style="color:#4b5563; font-size:13px; line-height:1.7; margin-bottom:10px;">
        <p style="margin:0 0 8px 0;"><strong style="color:${SECONDARY_COLOR};">Link not working?</strong> Copy and paste this URL into your browser:</p>
      </div>
      <div style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px 16px; margin-bottom:24px; word-break:break-all;">
        <a href="${resetUrl}" style="color:${INFO_COLOR}; font-size:12px; text-decoration:underline; font-family:'Courier New', monospace;">${resetUrl}</a>
      </div>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fef2f2; border-left:4px solid ${ERROR_COLOR}; border-radius:6px; padding:16px; margin-bottom:24px;">
        <tr>
          <td style="width:28px; vertical-align:top; padding-right:10px;">
            <div style="font-size:18px;">🛡️</div>
          </td>
          <td>
            <div style="color:${ERROR_COLOR}; font-size:13px; font-weight:700; margin-bottom:4px;">Didn't request this?</div>
            <div style="color:#881337; font-size:12px; line-height:1.7;">
              If you did not request a password reset, please ignore this email or contact IT Support immediately.
              Your account remains secure and your password will not be changed unless you use the link above.
            </div>
          </td>
        </tr>
      </table>
      <p style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.7; margin:0;">Stay secure,</p>
      <p style="color:${PRIMARY_COLOR}; font-size:15px; font-weight:700; margin:8px 0 0 0;">OneBridge Infotech IT Security Team</p>
    `;

    const html = this.renderBrandedEmail(subject, bodyHtml);
    return this.sendMail(to, subject, html);
  }

  public async sendOnboardingOfferEmail(
    to: string,
    candidateName: string,
    portalUrl: string,
    offer: {
      role: string;
      department: string;
      joiningDate: string;
      expiresOn: string;
    },
    attachments?: any[]
  ) {
    const subject = `Offer of Internship / Employment - OneBridge Infotech`;

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <h2 style="color:${SECONDARY_COLOR}; font-size:20px; font-weight:700; margin:0 0 8px 0;">Congratulations, ${candidateName}!</h2>
        <div style="height:3px; width:60px; background-color:${PRIMARY_COLOR}; border-radius:2px;"></div>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:15px; line-height:1.7; margin:0 0 20px 0;">
        On behalf of the entire team at <strong style="color:${PRIMARY_COLOR};">OneBridge Infotech</strong>, we are pleased to extend this offer to join our growing family.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border-radius:10px; padding:20px; margin-bottom:24px;">
        <tr>
          <td align="center">
            <div style="color:#c2410c; font-size:13px; font-weight:600; margin-bottom:8px;">OFFER SUMMARY</div>
            <div style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.8;">
              <strong>Position:</strong> ${offer.role}<br/>
              <strong>Department:</strong> ${offer.department}<br/>
              <strong>Date of Joining:</strong> ${offer.joiningDate}
            </div>
          </td>
        </tr>
      </table>
      <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 20px 0;">
        To accept this offer, please open the secure onboarding portal using the button below. You will be asked to review your offer letter, complete a short onboarding form and submit the required documents.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td style="background-color:${PRIMARY_COLOR}; border-radius:8px; padding:16px 36px;">
            <a href="${portalUrl}" style="color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; display:inline-block; letter-spacing:0.3px;">✅ Accept Offer & Start Onboarding</a>
          </td>
        </tr>
      </table>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fff7ed; border-left:4px solid ${WARNING_COLOR}; border-radius:6px; padding:16px; margin-bottom:24px;">
        <tr>
          <td style="width:28px; vertical-align:top; padding-right:10px;">
            <div style="font-size:18px;">⏳</div>
          </td>
          <td>
            <div style="color:#92400e; font-size:13px; font-weight:700; margin-bottom:4px;">Your onboarding link expires on ${offer.expiresOn}</div>
            <div style="color:#78350f; font-size:12px; line-height:1.6;">Please complete the process before this date. This is a private link intended only for you - please do not forward it.</div>
          </td>
        </tr>
      </table>
      <p style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.7; margin:0;">Best regards,</p>
      <p style="color:${PRIMARY_COLOR}; font-size:15px; font-weight:700; margin:8px 0 0 0;">OneBridge Infotech HR Team</p>

    `;

    const html = this.renderBrandedEmail(subject, bodyHtml);
    return this.sendMail(to, subject, html, attachments);
  }

  public async sendDocumentSubmittedNotification(
    to: string | string[],
    candidateName: string,
    summary: { documentCount: number; folderUrl?: string; portalUrl: string },
    attachments?: any[]
  ) {
    const subject = `Onboarding Documents Submitted - ${candidateName}`;
    const recipients = Array.isArray(to) ? to.join(', ') : to;

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <h2 style="color:${SECONDARY_COLOR}; font-size:20px; font-weight:700; margin:0 0 8px 0;">📥 Candidate Documents Submitted</h2>
        <div style="height:3px; width:60px; background-color:${SUCCESS_COLOR}; border-radius:2px;"></div>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:15px; line-height:1.7; margin:0 0 20px 0;">
        <strong style="color:${PRIMARY_COLOR};">${candidateName}</strong> has completed and submitted the onboarding form along with <strong>${summary.documentCount}</strong> document(s).
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0fdf4; border-left:4px solid ${SUCCESS_COLOR}; border-radius:6px; padding:16px; margin-bottom:24px;">
        <tr>
          <td style="width:28px; vertical-align:top; padding-right:10px;">
            <div style="font-size:18px;">📋</div>
          </td>
          <td>
            <div style="color:#166534; font-size:13px; font-weight:700; margin-bottom:4px;">Action Required</div>
            <div style="color:#14532d; font-size:12px; line-height:1.7;">Please review the submitted documents and verify the candidate's details. Approve, request changes, or reject from the Onboarding dashboard.</div>
          </td>
        </tr>
      </table>
      ${summary.folderUrl ? `
        <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 12px 0;">
          <strong>Document folder:</strong> <a href="${summary.folderUrl}" style="color:${PRIMARY_COLOR};">${summary.folderUrl}</a>
        </p>
      ` : ''}
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background-color:${PRIMARY_COLOR}; border-radius:8px; padding:14px 28px;">
            <a href="${summary.portalUrl}" style="color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; display:inline-block;">Open Onboarding Dashboard</a>
          </td>
        </tr>
      </table>
      <p style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.7; margin:0;">Regards,</p>
      <p style="color:${PRIMARY_COLOR}; font-size:15px; font-weight:700; margin:8px 0 0 0;">OneBridge Infotech HR System</p>
    `;

    const html = this.renderBrandedEmail(subject, bodyHtml);
    return this.sendMail(recipients, subject, html, attachments);
  }

  public async sendDocumentSubmittedConfirmation(
    to: string,
    candidateName: string,
    summary: { documentCount: number; referenceNumber?: string; folderUrl?: string; signatureHash?: string; submittedAt: Date }
  ) {
    const subject = `We've Received Your Documents - ${candidateName}`;
    const submittedOn = summary.submittedAt.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <h2 style="color:${SECONDARY_COLOR}; font-size:20px; font-weight:700; margin:0 0 8px 0;">✅ Documents Received Successfully</h2>
        <div style="height:3px; width:60px; background-color:${SUCCESS_COLOR}; border-radius:2px;"></div>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:15px; line-height:1.7; margin:0 0 20px 0;">
        Dear <strong style="color:${PRIMARY_COLOR};">${candidateName}</strong>,<br/>
        Thank you for accepting the internship offer and submitting <strong>${summary.documentCount}</strong> document(s) on <strong>${submittedOn}</strong>.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0fdf4; border-left:4px solid ${SUCCESS_COLOR}; border-radius:6px; padding:16px; margin-bottom:24px;">
        <tr>
          <td style="width:28px; vertical-align:top; padding-right:10px;">
            <div style="font-size:18px;">⏳</div>
          </td>
          <td>
            <div style="color:#166534; font-size:13px; font-weight:700; margin-bottom:4px;">What happens next?</div>
            <div style="color:#14532d; font-size:12px; line-height:1.7;">Our HR team will review your documents and verify your details. You will receive an update on your joining within a few working days. You can track the status anytime on your onboarding portal.</div>
          </td>
        </tr>
      </table>
      ${summary.referenceNumber ? `
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
          <tr><td style="padding:4px 0; color:#4b5563; font-size:14px;"><strong>Reference Number:</strong></td><td style="padding:4px 0; color:#4b5563; font-size:14px;">${summary.referenceNumber}</td></tr>
        </table>
      ` : ''}
      ${summary.folderUrl ? `
        <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 12px 0;">
          <strong>Document folder:</strong> <a href="${summary.folderUrl}" style="color:${PRIMARY_COLOR};">${summary.folderUrl}</a>
        </p>
      ` : ''}
      <p style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.7; margin:0;">Regards,</p>
      <p style="color:${PRIMARY_COLOR}; font-size:15px; font-weight:700; margin:8px 0 0 0;">OneBridge Infotech HR Team</p>
    `;

    const html = this.renderBrandedEmail(subject, bodyHtml);
    return this.sendMail(to, subject, html);
  }

  public async sendJoiningLetterEmail(
    to: string,
    candidateName: string,
    joining: {
      joiningDate: string;
      reportingTime: string;
      officeAddress: string;
      reportingManager: string;
      role: string;
    },
    pdfBuffer: Buffer
  ) {
    const subject = `Joining Confirmation - OneBridge Infotech`;

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <h2 style="color:${SECONDARY_COLOR}; font-size:20px; font-weight:700; margin:0 0 8px 0;">🎉 You're Confirmed to Join!</h2>
        <div style="height:3px; width:60px; background-color:${SUCCESS_COLOR}; border-radius:2px;"></div>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:15px; line-height:1.7; margin:0 0 20px 0;">Dear ${candidateName},</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius:12px; padding:22px; margin-bottom:24px;">
        <tr>
          <td>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px; color:#14532d; line-height:1.9;">
              <tr><td style="padding:4px 0;"><strong>Role:</strong></td><td>${joining.role}</td></tr>
              <tr><td style="padding:4px 0;"><strong>Joining Date:</strong></td><td>${joining.joiningDate}</td></tr>
              <tr><td style="padding:4px 0;"><strong>Reporting Time:</strong></td><td>${joining.reportingTime}</td></tr>
              <tr><td style="padding:4px 0;"><strong>Reporting Manager:</strong></td><td>${joining.reportingManager || 'HR Department'}</td></tr>
              <tr><td style="padding:4px 0;"><strong>Office Address:</strong></td><td>${joining.officeAddress}</td></tr>
            </table>
          </td>
        </tr>
      </table>
      <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 20px 0;">
        Please find your one-page <strong>Joining Letter</strong> attached to this email. Kindly carry a printed copy along with your government ID and educational documents on your joining day.
      </p>
      <p style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.7; margin:0;">See you soon!</p>

    `;

    const html = this.renderBrandedEmail(subject, bodyHtml);
    return this.sendMail(to, subject, html, [
      {
        filename: `Joining_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`,
        content: pdfBuffer,
      },
    ]);
  }

  public async sendOnboardingStatusEmail(
    to: string,
    candidateName: string,
    subject: string,
    headline: string,
    message: string,
    ctaUrl?: string,
    ctaLabel?: string,
    tone: 'success' | 'error' | 'warning' | 'info' = 'info'
  ) {
    const toneMap = {
      success: { bg: '#f0fdf4', border: SUCCESS_COLOR, title: SUCCESS_COLOR, text: '#14532d' },
      error: { bg: '#fef2f2', border: ERROR_COLOR, title: ERROR_COLOR, text: '#7f1d1d' },
      warning: { bg: '#fff7ed', border: WARNING_COLOR, title: WARNING_COLOR, text: '#7c2d12' },
      info: { bg: '#eff6ff', border: INFO_COLOR, title: INFO_COLOR, text: '#1e3a8a' },
    };
    const t = toneMap[tone];

    const ctaHtml = ctaUrl && ctaLabel
      ? `
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="background-color:${PRIMARY_COLOR}; border-radius:8px; padding:14px 28px;">
              <a href="${ctaUrl}" style="color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; display:inline-block;">${ctaLabel}</a>
            </td>
          </tr>
        </table>
      `
      : '';

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <h2 style="color:${SECONDARY_COLOR}; font-size:20px; font-weight:700; margin:0 0 8px 0;">${headline}</h2>
        <div style="height:3px; width:60px; background-color:${t.border}; border-radius:2px;"></div>
      </div>
      <p style="color:${SECONDARY_COLOR}; font-size:15px; line-height:1.7; margin:0 0 20px 0;">Dear ${candidateName},</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:${t.bg}; border-left:4px solid ${t.border}; border-radius:6px; padding:16px; margin-bottom:24px;">
        <tr>
          <td style="color:${t.text}; font-size:14px; line-height:1.7;">${message}</td>
        </tr>
      </table>
      ${ctaHtml}
      <p style="color:${SECONDARY_COLOR}; font-size:14px; line-height:1.7; margin:0;">Best regards,</p>

    `;

    const html = this.renderBrandedEmail(subject, bodyHtml);
    return this.sendMail(to, subject, html);
  }
}

export const emailService = new EmailService();
export default emailService;
