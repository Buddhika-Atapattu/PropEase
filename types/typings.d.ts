export interface USBDeviceInfo {
  vendorId: number;
  productId: number;
  class: number;
  manufacturer: string;
  product: string;
  serialNumber: string;
}

export interface WiFiScannerDevice {
  ip: string;
  hostname?: string;
  model?: string;
  manufacturer?: string;
  mac?: string;
}

declare global {
  interface Window {
    electron: {
      scanDocument(device): Promise<void>;
      getUSBDevices: () => Promise<USBDeviceInfo[]>;
      detectWiFiScanners: () => Promise<WiFiScannerDevice[]>;
    };
    google: any;
  }
}


export {};