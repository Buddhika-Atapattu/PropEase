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
exports.USBScannerService = void 0;
const usb = __importStar(require("usb"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class USBScannerService {
    static knownScannerVendors = [0x04a9, 0x04b8, 0x03f0, 0x04f9]; // Canon, Epson, HP, Brother
    static async getAllUSBDevices() {
        const rawDevices = usb.getDeviceList();
        const deviceInfos = await Promise.all(rawDevices.map(async (device) => {
            try {
                const descriptor = device.deviceDescriptor;
                if (!descriptor) {
                    throw new Error('Device descriptor is null');
                }
                // Optional vendor filtering
                if (!this.knownScannerVendors.includes(descriptor.idVendor)) {
                    // console.warn(
                    //   `Skipped unsupported USB device (vendorId: ${descriptor.idVendor})`
                    // );
                    return null;
                }
                // Open the device
                device.open();
                const manufacturer = await this.getDescriptorString(device, descriptor.iManufacturer);
                const product = await this.getDescriptorString(device, descriptor.iProduct);
                const serialNumber = await this.getDescriptorString(device, descriptor.iSerialNumber);
                device.close();
                if (descriptor.bDeviceClass === 6 ||
                    (descriptor.bDeviceClass === 0 && this.hasScannerInterface(device))) {
                    return {
                        vendorId: descriptor.idVendor,
                        productId: descriptor.idProduct,
                        class: descriptor.bDeviceClass,
                        manufacturer,
                        product,
                        serialNumber,
                        deviceDescriptor: descriptor,
                    };
                }
            }
            catch (err) {
                if (err && typeof err === 'object' && 'errno' in err) {
                    const error = err;
                    if (error.errno === -12 || error.errno === -5) {
                        console.warn(`Skipped unsupported USB device (vendorId: ${device.deviceDescriptor?.idVendor})`);
                    }
                    else {
                        console.error('Unexpected USB error:', err);
                    }
                }
                else {
                    console.error('Unknown error occurred:', err);
                }
                try {
                    device.close();
                }
                catch { }
                return null;
            }
        }));
        return deviceInfos.filter((info) => info !== null);
    }
    static async scan(device) {
        const platform = process.platform;
        if (platform === 'win32') {
            return this.scanWithWindows(device);
        }
        else if (platform === 'darwin') {
            return this.scanWithImageCapture(device); // macOS
        }
        else if (platform === 'linux') {
            return this.scanWithScanimage(device);
        }
        else {
            throw new Error(`Unsupported platform: ${platform}`);
        }
    }
    static async scanWithWindows(device) {
        // Example using WIA or TWAIN (typically requires native module or wrapper)
        console.log(`Initiating scan on Windows for: ${device.manufacturer}`);
        // Use external command or spawn TWAIN-compatible binary (e.g., NAPS2 CLI)
        throw new Error('Windows scanning is not yet implemented.');
    }
    static async scanWithImageCapture(device) {
        console.log(`Initiating scan on macOS for: ${device.manufacturer}`);
        try {
            const { stdout } = await execAsync(`imagesnap -w 2 ~/Desktop/scan.jpg`);
            console.log('Scan output:', stdout);
        }
        catch (err) {
            throw new Error(`macOS scan failed: ${err}`);
        }
    }
    static async scanWithScanimage(device) {
        console.log(`Initiating scan on Linux for: ${device.manufacturer}`);
        try {
            const { stdout } = await execAsync(`scanimage --format=png > ~/scan.png`);
            console.log('Scan output:', stdout);
        }
        catch (err) {
            throw new Error(`Linux scan failed: ${err}`);
        }
    }
    static hasScannerInterface(device) {
        try {
            const interfaces = device.configDescriptor?.interfaces || [];
            return interfaces.some((iface) => iface.some((intf) => intf.bInterfaceClass === 6));
        }
        catch {
            return false;
        }
    }
    static getDescriptorString(device, index) {
        return new Promise((resolve, reject) => {
            if (!index)
                return resolve('');
            device.getStringDescriptor(index, (err, data) => {
                if (err)
                    reject(err);
                else
                    resolve(data ?? '');
            });
        });
    }
}
exports.USBScannerService = USBScannerService;
