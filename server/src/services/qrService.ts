import QRCode from 'qrcode';

class QrService {
  public async generateEmployeeQr(employeeId: string): Promise<string> {
    try {
      const url = `https://hr.onebridgeinfotech.com/employee/${employeeId}`;
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300,
        color: {
          dark: '#1e293b', // slate-800
          light: '#ffffff',
        },
      });
      return dataUrl;
    } catch (error) {
      console.error('Failed to generate QR Code:', error);
      throw error;
    }
  }
}

export const qrService = new QrService();
export default qrService;
