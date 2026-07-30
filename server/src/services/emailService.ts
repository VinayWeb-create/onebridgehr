import nodemailer from 'nodemailer';

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private async getTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) return this.transporter;

    // Check if we have standard settings
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
      // Ethereal fallback for development
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
      const mailOptions = {
        from: '"OneBridge HR System" <hr@onebridgeinfotech.com>',
        to,
        subject,
        html,
        attachments,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent: ${info.messageId}`);
      
      // If using Ethereal, print preview URL
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

  public async sendPayslipEmail(email: string, employeeName: string, monthName: string, pdfBuffer: Buffer) {
    const subject = `Your Payslip for ${monthName}`;
    const html = `
      <h3>Dear ${employeeName},</h3>
      <p>Please find attached your payslip for the month of <strong>${monthName}</strong>.</p>
      <p>This is an automated system generated email. If you have any discrepancies, please reach out to the HR department.</p>
      <br/>
      <p>Best regards,</p>
      <p><strong>OneBridge Infotech HR Team</strong></p>
    `;

    return this.sendMail(email, subject, html, [
      {
        filename: `Payslip-${employeeName.replace(/\s+/g, '_')}-${monthName}.pdf`,
        content: pdfBuffer,
      },
    ]);
  }
}

export const emailService = new EmailService();
export default emailService;
