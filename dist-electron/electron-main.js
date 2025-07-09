"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// electron-main.ts
const electron_1 = require("electron");
const url = __importStar(require("url"));
const path = __importStar(require("path"));
const USBScannerService_1 = require("./services/USBScannerService");
const WIFIScannerService_1 = require("./services/WIFIScannerService");
const child_process_1 = require("child_process");
let cachedUSBDevices = [];
let cachedWiFiScanners = [];
const wifi = new WIFIScannerService_1.WIFIScannerService();
// const devices = await wifi.scanForDevices();
electron_1.ipcMain.handle('get-usb-devices', async () => {
    return cachedUSBDevices;
});
electron_1.ipcMain.handle('get-wifi-scanners', async () => {
    return cachedWiFiScanners;
});
electron_1.ipcMain.handle('scan-document', async (_event, device) => {
    console.log(device);
    try {
        // USB device scan
        if (device.vendorId && device.productId) {
            return await USBScannerService_1.USBScannerService.scan(device); // You need to define this method
        }
        // Wi-Fi device scan
        if (device.ip) {
            return await WIFIScannerService_1.WIFIScannerService.scan(device); // You need to define this method too
        }
        throw new Error('Unsupported device type');
    }
    catch (err) {
        console.error('Scan failed:', err);
        throw err;
    }
});
electron_1.ipcMain.handle('refresh-scanners', async () => {
    await preloadScanners();
    return { success: true };
});
async function preloadScanners() {
    cachedUSBDevices = await USBScannerService_1.USBScannerService.getAllUSBDevices();
    const wifi = new WIFIScannerService_1.WIFIScannerService();
    cachedWiFiScanners = await wifi.scanForDevices();
}
electron_1.app.whenReady().then(async () => {
    await preloadScanners(); // Load initially
    setInterval(preloadScanners, 60_000); // Refresh every 60 seconds (optional)
});
class ElectronApp {
    mainWindow = null;
    scanners = [];
    constructor() {
        this.initializeApp();
        this.setupReloadIfNeeded();
    }
    initializeApp() {
        electron_1.app.whenReady().then(() => {
            this.createWindow();
            this.checkDependencies();
        });
        electron_1.app.commandLine.appendSwitch('user-data-dir', path.join(electron_1.app.getPath('userData'), 'cache'));
        electron_1.app.on('window-all-closed', this.handleAllWindowsClosed);
        electron_1.app.on('activate', () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0)
                this.createWindow();
        });
    }
    checkDependencies() {
        const platform = process.platform;
        try {
            if (platform === 'darwin') {
                (0, child_process_1.execSync)('which imagesnap', { stdio: 'ignore' });
            }
            else if (platform === 'linux') {
                (0, child_process_1.execSync)('which scanimage', { stdio: 'ignore' });
            }
        }
        catch {
            electron_1.dialog.showMessageBox({
                type: 'warning',
                title: 'Missing Scanner Tool',
                message: platform === 'darwin'
                    ? 'The scanner tool "imagesnap" is required. Please install it by running:\nbrew install imagesnap'
                    : 'The scanner tool "scanimage" is required. Please install it by running:\nsudo apt install sane-utils',
            });
        }
    }
    createWindow() {
        this.mainWindow = new electron_1.BrowserWindow({
            width: 1200,
            height: 800,
            icon: path.join(__dirname, '..', 'public', 'Images', 'company-images', 'ICO', 'PropEaseLogo.ico'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, './preload.js'),
            },
        });
        if (!electron_1.app.isPackaged) {
            this.mainWindow.loadURL('http://localhost:4200');
            this.mainWindow.webContents.openDevTools();
        }
        else {
            this.mainWindow.loadURL(url.format({
                pathname: path.join(__dirname, 'dist/propease-fontend/index.html'),
                protocol: 'file:',
                slashes: true,
            }));
        }
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });
    }
    setupReloadIfNeeded() {
        if (!electron_1.app.isPackaged) {
            try {
                require('electron-reload')(__dirname, {
                    electron: require(path.join(__dirname, '..', 'node_modules', 'electron')),
                    forceHardReset: true,
                    hardResetMethod: 'exit',
                });
                console.log('[electron-reload] Watching for changes...');
            }
            catch (err) {
                console.warn('electron-reload failed to initialize:', err);
            }
        }
    }
    handleAllWindowsClosed() {
        if (process.platform !== 'darwin') {
            electron_1.app.quit();
            console.log('Electron and Angular apps closed. Have nice day!');
        }
    }
}
new ElectronApp();
