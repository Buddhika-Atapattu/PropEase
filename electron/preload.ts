import { contextBridge, ipcRenderer } from 'electron';

interface USBDeviceInfo {
  vendorId: number;
  productId: number;
  class: number;
  manufacturer: string;
  product: string;
  serialNumber: string;
}

interface WiFiScannerDevice {
  ip: string;
  hostname?: string;
  model?: string;
  manufacturer?: string;
}

contextBridge.exposeInMainWorld('electron', {
  detectMobileScanners: () => ipcRenderer.invoke('detect-mobile-scanners'),
  detectScanners: () => ipcRenderer.invoke('detect-scanners'),
  scanDocument: (device: USBDeviceInfo | WiFiScannerDevice) =>
    ipcRenderer.invoke('scan-document', device),
  getUSBDevices: () => ipcRenderer.invoke('get-usb-devices'),
  detectWiFiScanners: () => ipcRenderer.invoke('get-wifi-scanners'),
});
