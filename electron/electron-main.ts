// electron-main.ts
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as url from 'url';
import * as path from 'path';
import * as usb from 'usb';
import { USBScannerService } from './services/USBScannerService';
import { WIFIScannerService } from './services/WIFIScannerService';
import { execSync } from 'child_process';

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
}

let cachedUSBDevices: USBDeviceInfo[] = [];
let cachedWiFiScanners: WiFiScannerDevice[] = [];
const wifi = new WIFIScannerService();
// const devices = await wifi.scanForDevices();

ipcMain.handle('get-usb-devices', async () => {
  return cachedUSBDevices;
});

ipcMain.handle('get-wifi-scanners', async () => {
  return cachedWiFiScanners;
});

ipcMain.handle('scan-document', async (_event, device) => {
  console.log(device);
  try {
    // USB device scan
    if (device.vendorId && device.productId) {
      return await USBScannerService.scan(device); // You need to define this method
    }

    // Wi-Fi device scan
    if (device.ip) {
      return await WIFIScannerService.scan(device); // You need to define this method too
    }

    throw new Error('Unsupported device type');
  } catch (err) {
    console.error('Scan failed:', err);
    throw err;
  }
});

ipcMain.handle('refresh-scanners', async () => {
  await preloadScanners();
  return { success: true };
});

async function preloadScanners() {
  cachedUSBDevices = await USBScannerService.getAllUSBDevices();
  const wifi = new WIFIScannerService();
  cachedWiFiScanners = await wifi.scanForDevices();
}

app.whenReady().then(async () => {
  await preloadScanners(); // Load initially
  setInterval(preloadScanners, 60_000); // Refresh every 60 seconds (optional)
});

class ElectronApp {
  private mainWindow: BrowserWindow | null = null;
  private scanners: string[] = [];

  constructor() {
    this.initializeApp();
    this.setupReloadIfNeeded();
  }

  private initializeApp() {
    app.whenReady().then(() => {
      this.createWindow();
      this.checkDependencies();
    });
    app.commandLine.appendSwitch(
      'user-data-dir',
      path.join(app.getPath('userData'), 'cache')
    );

    app.on('window-all-closed', this.handleAllWindowsClosed);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) this.createWindow();
    });
  }

  private checkDependencies() {
    const platform = process.platform;

    try {
      if (platform === 'darwin') {
        execSync('which imagesnap', { stdio: 'ignore' });
      } else if (platform === 'linux') {
        execSync('which scanimage', { stdio: 'ignore' });
      }
    } catch {
      dialog.showMessageBox({
        type: 'warning',
        title: 'Missing Scanner Tool',
        message:
          platform === 'darwin'
            ? 'The scanner tool "imagesnap" is required. Please install it by running:\nbrew install imagesnap'
            : 'The scanner tool "scanimage" is required. Please install it by running:\nsudo apt install sane-utils',
      });
    }
  }

  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      icon: path.join(
        __dirname,
        '..',
        'public',
        'Images',
        'company-images',
        'ICO',
        'PropEaseLogo.ico'
      ),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, './preload.js'),
      },
    });

    if (!app.isPackaged) {
      this.mainWindow.loadURL('http://localhost:4200');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadURL(
        url.format({
          pathname: path.join(__dirname, 'dist/propease-fontend/index.html'),
          protocol: 'file:',
          slashes: true,
        })
      );
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupReloadIfNeeded() {
    if (!app.isPackaged) {
      try {
        require('electron-reload')(__dirname, {
          electron: require(path.join(
            __dirname,
            '..',
            'node_modules',
            'electron'
          )),
          forceHardReset: true,
          hardResetMethod: 'exit',
        });
        console.log('[electron-reload] Watching for changes...');
      } catch (err) {
        console.warn('electron-reload failed to initialize:', err);
      }
    }
  }

  private handleAllWindowsClosed() {
    if (process.platform !== 'darwin') {
      app.quit();
      console.log('Electron and Angular apps closed. Have nice day!');
    }
  }
}

new ElectronApp();
