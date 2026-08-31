import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/db';

export class CommunicationService {
  private static transporter: nodemailer.Transporter | null = null;

  private static getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;

    const host = process.env.EMAIL_HOST || 'smtp.hostinger.com';
    const port = parseInt(process.env.EMAIL_PORT || '587');
    const user = process.env.EMAIL_USER || '';
    const pass = process.env.EMAIL_PASS || '';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });

    return this.transporter;
  }

  private static getFromAddress(displayName = 'OneBridge Infotech'): string {
    const user = process.env.EMAIL_USER || 'vinay@onebridgeinfotech.com';
    return `"${displayName}" <${user}>`;
  }

  /**
   * Helper to replace placeholders like {{clientName}}, {{invoiceNumber}}, {{amount}}
   */
  public static renderTemplate(template: string, data: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value ?? ''));
    }
    return result;
  }

  /**
   * Send Automated Welcome & Discovery Acknowledgment Email to Lead
   */
  public static async sendLeadWelcomeEmail(lead: any): Promise<boolean> {
    const serviceName = lead.serviceOfInterest || 'Technology & Cloud Solutions';
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    
    const subject = `Thank you for reaching out to OneBridge Infotech [Inquiry #${lead.leadNumber}]`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 28px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #f97316; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">ONE<span style="color: #ffffff;">BRIDGE</span></h1>
          <p style="color: #cbd5e1; margin: 6px 0 0 0; font-size: 13px; font-weight: 600;">Enterprise Technology & AI Solutions</p>
        </div>
        <div style="padding: 28px; border: 1px solid #e2e8f0; border-top: none; background: #ffffff; border-radius: 0 0 12px 12px;">
          <p style="font-size: 15px;">Dear <strong>${lead.clientName}</strong>,</p>
          <p>Thank you for reaching out to <strong>OneBridge Infotech</strong>. We have received your inquiry regarding <strong>${serviceName}</strong>.</p>
          
          <div style="background-color: #f8fafc; padding: 18px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f97316;">
            <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Inquiry Reference:</strong> <span style="font-family: monospace; font-weight: bold; color: #4f46e5;">${lead.leadNumber}</span></p>
            <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Service of Interest:</strong> ${serviceName}</p>
            ${lead.companyName ? `<p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Company:</strong> ${lead.companyName}</p>` : ''}
            ${lead.timeline ? `<p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Timeline:</strong> ${lead.timeline}</p>` : ''}
            ${lead.projectDetails ? `<p style="margin: 0; font-size: 13px;"><strong>Project Scope:</strong> ${lead.projectDetails}</p>` : ''}
          </div>

          <h3 style="color: #0f172a; font-size: 15px; margin-top: 24px;">Next Steps:</h3>
          <p style="font-size: 14px;">Our solutions architecture team is reviewing your project details. Please select how you would like to proceed:</p>

          <div style="text-align: center; margin: 22px 0;">
            <a href="${clientUrl}/proposal/request/${lead.id}" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 14px 24px; font-weight: bold; font-size: 14px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); margin-bottom: 12px; min-width: 200px;">
              📄 Request Business Proposal
            </a>
            <br/>
            <a href="${clientUrl}/demo/book/${lead.id}" style="background: linear-gradient(135deg, #f97316 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 24px; font-weight: bold; font-size: 14px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3); min-width: 200px;">
              📅 Book Live Demo
            </a>
          </div>

          <div style="background-color: #f1f5f9; padding: 14px; border-radius: 8px; margin-top: 24px; font-size: 12px; color: #64748b;">
            <p style="margin: 0 0 4px 0;"><strong>Direct Contact Coordinates:</strong></p>
            <p style="margin: 0 0 2px 0;">📧 Email: <a href="mailto:info@onebridgeinfotech.com" style="color: #4f46e5;">info@onebridgeinfotech.com</a></p>
            <p style="margin: 0 0 2px 0;">📞 Phone: +91 939835 5196</p>
            <p style="margin: 0;">🏢 Corporate Office: 202, Sathyabama complex, Bhagya Nagar Colony, KPHB, Hyderabad, Telangana 500072</p>
          </div>

          <br/>
          <p style="margin-bottom: 0;">Warm regards,</p>
          <p style="margin-top: 4px;"><strong>Enterprise Solutions Team</strong><br/>OneBridge Infotech Pvt. Ltd.<br/><a href="https://www.onebridgeinfotech.com" style="color: #f97316; text-decoration: none;">www.onebridgeinfotech.com</a></p>
        </div>
      </div>
    `;

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: this.getFromAddress('OneBridge Infotech'),
        to: lead.email,
        subject,
        html: htmlBody,
      });

      // Log Communication
      await prisma.communicationLog.create({
        data: {
          channel: 'EMAIL',
          recipient: lead.email,
          recipientName: lead.clientName,
          subject,
          messageBody: `Automated Lead Welcome & Demo Booking Email for Inquiry #${lead.leadNumber}`,
          status: 'SENT',
          referenceId: lead.id,
        },
      });

      return true;
    } catch (err: any) {
      console.error('[CommunicationService] Failed to send lead welcome email:', err);
      try {
        await prisma.communicationLog.create({
          data: {
            channel: 'EMAIL',
            recipient: lead.email,
            recipientName: lead.clientName,
            subject,
            messageBody: `Failed to send lead welcome email for #${lead.leadNumber}`,
            status: 'FAILED',
            errorMessage: err.message,
            referenceId: lead.id,
          },
        });
      } catch (logErr) {}
      return false;
    }
  }

  public static async sendProposalRequestConfirmation(lead: any): Promise<boolean> {
    const subject = `Your Proposal Request Received [Inquiry #${lead.leadNumber}]`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 28px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #f97316; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">ONE<span style="color: #ffffff;">BRIDGE</span></h1>
        </div>
        <div style="padding: 28px; border: 1px solid #e2e8f0; border-top: none; background: #ffffff; border-radius: 0 0 12px 12px;">
          <p style="font-size: 15px;">Dear <strong>${lead.clientName}</strong>,</p>
          <p>We have successfully received your detailed project requirements. Our Solutions Architecture team is now reviewing your goals and challenges to prepare a comprehensive business proposal.</p>
          <p>We will notify you via email as soon as your customized proposal is ready for review.</p>
          <br/>
          <p style="margin-bottom: 0;">Warm regards,</p>
          <p style="margin-top: 4px;"><strong>Enterprise Solutions Team</strong><br/>OneBridge Infotech Pvt. Ltd.</p>
        </div>
      </div>
    `;

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: this.getFromAddress('OneBridge Infotech'),
        to: lead.email,
        subject,
        html: htmlBody,
      });
      return true;
    } catch (err) {
      console.error('[CommunicationService] Failed to send proposal confirmation:', err);
      return false;
    }
  }

  public static async sendDemoConfirmation(lead: any, demoDetails: any): Promise<boolean> {
    const isOnline = demoDetails.type === 'ONLINE';
    const subject = `Demo Session Confirmed [Inquiry #${lead.leadNumber}]`;
    const meetingInfo = isOnline 
      ? `<p><strong>Google Meet Link:</strong> <a href="https://meet.google.com/mock-link-123">https://meet.google.com/mock-link-123</a><br/><strong>Timezone:</strong> ${demoDetails.timezone}</p>`
      : `<p><strong>Office Location:</strong> ${demoDetails.officeLocation}<br/><strong>Your Address:</strong> ${demoDetails.customerAddress || 'N/A'}</p>`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 28px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #f97316; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">ONE<span style="color: #ffffff;">BRIDGE</span></h1>
        </div>
        <div style="padding: 28px; border: 1px solid #e2e8f0; border-top: none; background: #ffffff; border-radius: 0 0 12px 12px;">
          <p style="font-size: 15px;">Dear <strong>${lead.clientName}</strong>,</p>
          <p>Your ${isOnline ? 'Online Demo' : 'Offline Meeting'} has been successfully scheduled!</p>
          
          <div style="background-color: #f8fafc; padding: 18px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f97316;">
            <p style="margin: 0 0 6px 0;"><strong>Date:</strong> ${demoDetails.date}</p>
            <p style="margin: 0 0 6px 0;"><strong>Time:</strong> ${demoDetails.time}</p>
            ${meetingInfo}
            <p style="margin: 6px 0 0 0;"><strong>Purpose:</strong> ${demoDetails.purpose}</p>
          </div>

          <p>If you need to reschedule, please contact us.</p>
          <br/>
          <p style="margin-bottom: 0;">Warm regards,</p>
          <p style="margin-top: 4px;"><strong>Enterprise Solutions Team</strong><br/>OneBridge Infotech Pvt. Ltd.</p>
        </div>
      </div>
    `;

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: this.getFromAddress('OneBridge Infotech'),
        to: lead.email,
        subject,
        html: htmlBody,
      });
      return true;
    } catch (err) {
      console.error('[CommunicationService] Failed to send demo confirmation:', err);
      return false;
    }
  }

  /**
   * Send Automated Admin Alert for Incoming Lead
   */
  public static async sendLeadAdminAlertEmail(lead: any): Promise<boolean> {
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_USER || 'vinay@onebridgeinfotech.com';
    const serviceName = lead.serviceOfInterest || 'General Inquiry';
    const subject = `🔥 New Lead Received: ${lead.clientName} (${serviceName})`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
        <div style="background-color: #0f172a; padding: 20px; border-radius: 8px 8px 0 0; color: white;">
          <h2 style="margin: 0; color: #f97316;">New Website Enterprise Lead</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">OneBridge Infotech Leads Ingestion</p>
        </div>
        <div style="padding: 20px; border: 1px solid #e2e8f0; background: #ffffff; border-radius: 0 0 8px 8px;">
          <p>A new inquiry was submitted via the contact form:</p>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Lead No:</strong> ${lead.leadNumber}</li>
            <li><strong>Client Name:</strong> ${lead.clientName}</li>
            <li><strong>Email:</strong> <a href="mailto:${lead.email}">${lead.email}</a></li>
            <li><strong>Phone:</strong> <a href="tel:${lead.phone}">${lead.phone}</a></li>
            <li><strong>Company:</strong> ${lead.companyName || 'N/A'}</li>
            <li><strong>Service of Interest:</strong> ${serviceName}</li>
            <li><strong>Timeline:</strong> ${lead.timeline || 'Flexible'}</li>
            <li><strong>Estimated Budget:</strong> ₹${(lead.estimatedValue || 0).toLocaleString('en-IN')}</li>
          </ul>
          <div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; margin: 16px 0;">
            <strong>Project Requirements:</strong>
            <p style="margin: 6px 0 0 0; font-size: 13px;">${lead.projectDetails || 'No additional details provided.'}</p>
          </div>
        </div>
      </div>
    `;

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: this.getFromAddress('OneBridge Leads Bot'),
        to: adminEmail,
        subject,
        html: htmlBody,
      });
      return true;
    } catch (err) {
      console.warn('[CommunicationService] Admin lead notification email skipped/failed:', err);
      return false;
    }
  }

  /**
   * Send Quotation via Email
   */
  public static async sendQuotationEmail(quotation: any, pdfRelativePath: string): Promise<boolean> {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const fullPdfPath = path.join(process.cwd(), pdfRelativePath.replace(/^\//, ''));
    const attachments = fs.existsSync(fullPdfPath)
      ? [{ filename: `Quotation_${quotation.quotationNumber}.pdf`, path: fullPdfPath }]
      : [];

    const subject = `Estimate & Quotation #${quotation.quotationNumber} from OneBridge Infotech`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
        <div style="background-color: #0f172a; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px;">OneBridge Infotech Pvt. Ltd.</h1>
          <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px;">Formal Estimate & Technical Proposal</p>
        </div>
        <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background: #ffffff; border-radius: 0 0 8px 8px;">
          <p>Dear <strong>${quotation.clientName}</strong>,</p>
          <p>Thank you for expressing interest in our services. We are pleased to provide you with the formal estimate and proposal for your requirements.</p>
          
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <p style="margin: 0 0 8px 0;"><strong>Quotation No:</strong> ${quotation.quotationNumber}</p>
            <p style="margin: 0 0 8px 0;"><strong>Total Estimate:</strong> ₹${Number(quotation.totalAmount).toLocaleString('en-IN')}</p>
            <p style="margin: 0;"><strong>Valid Until:</strong> ${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString('en-IN') : '30 Days'}</p>
          </div>

          <p>Please find the itemized quotation document attached with this email.</p>

          <!-- Interactive Action Block -->
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 18px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 12px 0; font-weight: bold; color: #166534; font-size: 14px;">Next Action Steps:</p>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
              <a href="${clientUrl}/payment/${quotation.id}" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 20px; font-weight: bold; font-size: 13px; border-radius: 6px; display: inline-block; margin: 4px;">
                ✅ Accept this offer
              </a>

            </div>
          </div>

          <p style="font-size: 13px; color: #64748b;">Upon your acceptance, our AI Finance Officer (Fiona) will immediately generate your official Tax Invoice and payment coordinates for seamless project kickoff.</p>

          <br/>
          <p style="margin-bottom: 0;">Warm regards,</p>
          <p style="margin-top: 4px;"><strong>Enterprise Solutions Team</strong><br/>OneBridge Infotech Pvt. Ltd.<br/>info@onebridgeinfotech.com</p>
        </div>
      </div>
    `;

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: this.getFromAddress('OneBridge Infotech'),
        to: quotation.clientEmail,
        subject,
        html: htmlBody,
        attachments,
      });

      // Log Communication
      await prisma.communicationLog.create({
        data: {
          channel: 'EMAIL',
          recipient: quotation.clientEmail,
          recipientName: quotation.clientName,
          subject,
          messageBody: `Quotation #${quotation.quotationNumber} sent to ${quotation.clientEmail}`,
          status: 'SENT',
          referenceId: quotation.id,
        },
      });

      return true;
    } catch (err: any) {
      console.error('[CommunicationService] Failed to send quotation email:', err);
      await prisma.communicationLog.create({
        data: {
          channel: 'EMAIL',
          recipient: quotation.clientEmail,
          recipientName: quotation.clientName,
          subject,
          messageBody: `Failed to send quotation #${quotation.quotationNumber}`,
          status: 'FAILED',
          errorMessage: err.message,
          referenceId: quotation.id,
        },
      });
      return false;
    }
  }

  /**
   * Send Official Tax Invoice via Email
   */
  public static async sendInvoiceEmail(invoice: any, pdfRelativePath: string): Promise<boolean> {
    const fullPdfPath = path.join(process.cwd(), pdfRelativePath.replace(/^\//, ''));
    const attachments = fs.existsSync(fullPdfPath)
      ? [{ filename: `Tax_Invoice_${invoice.invoiceNumber}.pdf`, path: fullPdfPath }]
      : [];

    const isPaid = invoice.paymentStatus === 'PAID';
    const subject = `Tax Invoice #${invoice.invoiceNumber} from OneBridge Infotech [${invoice.paymentStatus}]`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
        <div style="background-color: #0f172a; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px;">OneBridge Infotech Pvt. Ltd.</h1>
          <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px;">Official Tax Invoice</p>
        </div>
        <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background: #ffffff; border-radius: 0 0 8px 8px;">
          <p>Dear <strong>${invoice.clientName}</strong>,</p>
          <p>Please find attached your official Tax Invoice for services rendered.</p>
          
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid ${isPaid ? '#16a34a' : '#ea580c'};">
            <p style="margin: 0 0 8px 0;"><strong>Invoice No:</strong> ${invoice.invoiceNumber}</p>
            <p style="margin: 0 0 8px 0;"><strong>Total Amount:</strong> ₹${Number(invoice.totalAmount).toLocaleString('en-IN')}</p>
            <p style="margin: 0 0 8px 0;"><strong>Payment Status:</strong> <span style="color: ${isPaid ? '#16a34a' : '#dc2626'}; font-weight: bold;">${invoice.paymentStatus}</span></p>
            ${!isPaid ? `<p style="margin: 0 0 8px 0;"><strong>Balance Due:</strong> ₹${Number(invoice.balanceDue).toLocaleString('en-IN')}</p>` : ''}
            <p style="margin: 0;"><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}</p>
          </div>

          ${!isPaid ? `
          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 14px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0 0 6px 0; font-weight: bold; color: #065f46;">Bank & UPI Payment Details:</p>
            <p style="margin: 0; font-size: 13px; color: #047857;">
              <strong>Account:</strong> OneBridge Infotech Pvt Ltd<br/>
              <strong>Bank:</strong> HDFC Bank Ltd | A/C: 50200012345678 | IFSC: HDFC0001234<br/>
              <strong>UPI ID:</strong> onebridge@hdfcbank
            </p>
          </div>
          ` : ''}

          <p>A copy of the invoice is attached to this email for your accounting records.</p>
          <br/>
          <p style="margin-bottom: 0;">Thank you for your business!</p>
          <p style="margin-top: 4px;"><strong>Finance & Accounts Team</strong><br/>OneBridge Infotech Pvt. Ltd.</p>
        </div>
      </div>
    `;

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: this.getFromAddress('OneBridge Billing'),
        to: invoice.clientEmail,
        subject,
        html: htmlBody,
        attachments,
      });

      // Log Communication
      await prisma.communicationLog.create({
        data: {
          channel: 'EMAIL',
          recipient: invoice.clientEmail,
          recipientName: invoice.clientName,
          subject,
          messageBody: `Invoice #${invoice.invoiceNumber} sent to ${invoice.clientEmail}`,
          status: 'SENT',
          referenceId: invoice.id,
        },
      });

      return true;
    } catch (err: any) {
      console.error('[CommunicationService] Failed to send invoice email:', err);
      await prisma.communicationLog.create({
        data: {
          channel: 'EMAIL',
          recipient: invoice.clientEmail,
          recipientName: invoice.clientName,
          subject,
          messageBody: `Failed to send invoice #${invoice.invoiceNumber}`,
          status: 'FAILED',
          errorMessage: err.message,
          referenceId: invoice.id,
        },
      });
      return false;
    }
  }

  /**
   * Dispatch WhatsApp Message (Integration with WhatsApp Cloud API / Twilio or direct Link builder)
   */
  public static async sendWhatsAppNotification(
    phone: string,
    messageText: string,
    referenceId?: string,
    recipientName?: string
  ): Promise<{ success: boolean; whatsappUrl?: string }> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const encodedMsg = encodeURIComponent(messageText);
    const directUrl = `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}?text=${encodedMsg}`;

    // If WHATSAPP_API_KEY or Cloud API is configured in .env, execute HTTP dispatch
    const cloudApiToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (cloudApiToken && phoneId) {
      try {
        const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cloudApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone,
            type: 'text',
            text: { body: messageText },
          }),
        });
        const resData = await response.json();
        
        await prisma.communicationLog.create({
          data: {
            channel: 'WHATSAPP',
            recipient: phone,
            recipientName,
            messageBody: messageText,
            status: response.ok ? 'DELIVERED' : 'FAILED',
            metadata: resData as any,
            referenceId,
          },
        });

        return { success: response.ok, whatsappUrl: directUrl };
      } catch (err: any) {
        console.error('[CommunicationService] WhatsApp API dispatch failed:', err);
      }
    }

    // Default Log as SENT/QUEUED for Super Admin one-click dispatch
    await prisma.communicationLog.create({
      data: {
        channel: 'WHATSAPP',
        recipient: phone,
        recipientName,
        messageBody: messageText,
        status: 'SENT',
        referenceId,
      },
    });

    return { success: true, whatsappUrl: directUrl };
  }
}
