import QRCode from 'qrcode';

class QrService {
  public async generateEmployeeQr(employeeId: string): Promise<string> {
    try {
      const url = `https://hr.onebridgeinfotech.com/employee/${employeeId}`;
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 300,
        color: {
          dark: '#000000', // Pure black for maximum contrast
          light: '#ffffff',
        },
      });
      return dataUrl;
    } catch (error) {
      console.error('Failed to generate QR Code:', error);
      throw error;
    }
  }

  public async generateCustomQr(url: string): Promise<string> {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 300,
        color: {
          dark: '#000000', // Pure black for maximum contrast
          light: '#ffffff',
        },
      });
      return dataUrl;
    } catch (error) {
      console.error('Failed to generate Custom QR Code:', error);
      throw error;
    }
  }
}

export const qrService = new QrService();
export default qrService;
