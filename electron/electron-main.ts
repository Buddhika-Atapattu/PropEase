// electron-main.ts
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as url from 'url';
import * as path from 'path';
import { execSync } from 'child_process';

import { USBScannerService } from './services/USBScannerService';
import { WIFIScannerService } from './services/WIFIScannerService';
import { environment } from '../src/environments/environment.electron';

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

class ElectronApp {
  private mainWindow: BrowserWindow | null = null;

  // cached device lists (served by IPC)
  private cachedUSBDevices: USBDeviceInfo[] = [];
  private cachedWiFiScanners: WiFiScannerDevice[] = [];

  private wifiScannerService = new WIFIScannerService();

  public constructor () {
    // ✅ MUST be done BEFORE app.whenReady() / window creation
    this.configureAppPaths();

    // IPC can be registered immediately (no need to wait)
    this.registerIpcHandlers();

    this.setupReloadIfNeeded();
    this.registerAppLifecycle();

    // Start the app boot
    void this.boot();
  }

  // ────────────────────────────────────────────────────────────
  // 1) Fix cache / userData permission issues
  // ────────────────────────────────────────────────────────────
  private configureAppPaths(): void {
    // Put app data in a stable writable folder:
    // %APPDATA%/PropEase (Windows), ~/Library/Application Support/PropEase (macOS), etc.
    const stableUserData = path.join( app.getPath( 'appData' ), 'PropEase' );

    app.setPath( 'userData', stableUserData );
    app.setPath( 'cache', path.join( stableUserData, 'Cache' ) );

    // Optional: reduce shader cache related noise on some machines
    app.commandLine.appendSwitch( 'disable-gpu-shader-disk-cache' );
  }

  // ────────────────────────────────────────────────────────────
  // 2) Single boot flow (no duplicate whenReady blocks)
  // ────────────────────────────────────────────────────────────
  private async boot(): Promise<void> {
    await app.whenReady();

    // Load scanners once on startup
    await this.preloadScanners();

    // Refresh every 60 seconds (optional)
    setInterval( () => void this.preloadScanners(), 60_000 );

    this.createWindow();
    this.checkDependencies();
  }

  private async preloadScanners(): Promise<void> {
    try {
      this.cachedUSBDevices = await USBScannerService.getAllUSBDevices();
      this.cachedWiFiScanners = await this.wifiScannerService.scanForDevices();
    } catch ( error ) {
      console.warn( '[Warning:] [Electron] preloadScanners failed.\n', error );
      // Keep old cache if refresh fails
    }
  }

  // ────────────────────────────────────────────────────────────
  // IPC (Angular ↔ Electron main)
  // ────────────────────────────────────────────────────────────
  private registerIpcHandlers(): void {
    ipcMain.handle( 'get-usb-devices', async () => {
      return this.cachedUSBDevices;
    } );

    ipcMain.handle( 'get-wifi-scanners', async () => {
      return this.cachedWiFiScanners;
    } );

    ipcMain.handle( 'refresh-scanners', async () => {
      await this.preloadScanners();
      return { success: true };
    } );

    ipcMain.handle( 'scan-document', async ( _event, device ) => {
      try {
        if ( device?.vendorId && device?.productId ) {
          return await USBScannerService.scan( device );
        }

        if ( device?.ip ) {
          return await WIFIScannerService.scan( device );
        }

        throw new Error( 'Unsupported device type' );
      } catch ( err ) {
        console.error( '[Error:] [Electron] scan-document failed.\n', err );
        throw err;
      }
    } );
  }

  // ────────────────────────────────────────────────────────────
  // Window
  // ────────────────────────────────────────────────────────────
  private createWindow(): void {
    this.mainWindow = new BrowserWindow( {
      width: 1200,
      height: 800,
      icon: path.join(
        __dirname,
        '..',
        'public',
        'Images',
        'company-images',
        'logo',
        'win',
        'without-bg-and-letters.ico'
      ),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join( __dirname, './preload.js' ),
      },
    } );

    if ( !app.isPackaged ) {
      this.mainWindow.loadURL( environment.localRoot );
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadURL(
        url.format( {
          pathname: path.join( __dirname, 'dist/propease-fontend/index.html' ),
          protocol: 'file:',
          slashes: true,
        } )
      );
    }

    this.mainWindow.on( 'closed', () => {
      this.mainWindow = null;
    } );
  }

  // ────────────────────────────────────────────────────────────
  // Dependencies checks
  // ────────────────────────────────────────────────────────────
  private checkDependencies(): void {
    const platform = process.platform;

    try {
      if ( platform === 'darwin' ) {
        execSync( 'which imagesnap', { stdio: 'ignore' } );
      } else if ( platform === 'linux' ) {
        execSync( 'which scanimage', { stdio: 'ignore' } );
      }
    } catch {
      dialog.showMessageBox( {
        type: 'warning',
        title: 'Missing Scanner Tool',
        message:
          platform === 'darwin'
            ? 'The scanner tool "imagesnap" is required. Install:\nbrew install imagesnap'
            : 'The scanner tool "scanimage" is required. Install:\nsudo apt install sane-utils',
      } );
    }
  }

  // ────────────────────────────────────────────────────────────
  // Dev reload
  // ────────────────────────────────────────────────────────────
  private setupReloadIfNeeded(): void {
    if ( !app.isPackaged ) {
      try {
        // NOTE: hardResetMethod: 'exit' will close the app during reload.
        // That’s why you see “Have nice day!” often.
        // Keep it if you like, but don’t treat it as a crash.
        // If you want less confusion, remove hardResetMethod.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require( 'electron-reload' )( __dirname, {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          electron: require( path.join( __dirname, '..', 'node_modules', 'electron' ) ),
          forceHardReset: true,
          // hardResetMethod: 'exit', // <- OPTIONAL: comment this out to reduce exit noise
        } );

        console.log( '[Info:] [electron-reload] Watching for changes...\n' );
      } catch ( err ) {
        console.warn( '[Warning:] [electron-reload] init failed.\n', err );
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // App lifecycle
  // ────────────────────────────────────────────────────────────
  private registerAppLifecycle(): void {
    app.on( 'window-all-closed', () => {
      if ( process.platform !== 'darwin' ) {
        app.quit();
        console.log( '[Info:] [Electron] All windows closed. Exiting.\n' );
      }
    } );

    app.on( 'activate', () => {
      if ( BrowserWindow.getAllWindows().length === 0 ) {
        this.createWindow();
      }
    } );
  }
}

new ElectronApp();
