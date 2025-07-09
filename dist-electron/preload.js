"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electron', {
    detectMobileScanners: () => electron_1.ipcRenderer.invoke('detect-mobile-scanners'),
    detectScanners: () => electron_1.ipcRenderer.invoke('detect-scanners'),
    scanDocument: (device) => electron_1.ipcRenderer.invoke('scan-document', device),
    getUSBDevices: () => electron_1.ipcRenderer.invoke('get-usb-devices'),
    detectWiFiScanners: () => electron_1.ipcRenderer.invoke('get-wifi-scanners'),
});
