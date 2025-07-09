import * as usb from 'usb';
import { Device } from 'usb';
import { exec } from 'child_process';
import { promisify } from 'util';

export interface USBDeviceInfo {
  vendorId: number;
  productId: number;
  class: number;
  manufacturer: string;
  product: string;
  serialNumber: string;
  deviceDescriptor?: usb.DeviceDescriptor;
}

const execAsync = promisify(exec);

export class USBScannerService {
  private static knownScannerVendors = [0x04a9, 0x04b8, 0x03f0, 0x04f9]; // Canon, Epson, HP, Brother

  static async getAllUSBDevices(): Promise<USBDeviceInfo[]> {
    const rawDevices = usb.getDeviceList();

    const deviceInfos = await Promise.all(
      rawDevices.map(async (device) => {
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

          const manufacturer = await this.getDescriptorString(
            device,
            descriptor.iManufacturer
          );

          const product = await this.getDescriptorString(
            device,
            descriptor.iProduct
          );

          const serialNumber = await this.getDescriptorString(
            device,
            descriptor.iSerialNumber
          );

          device.close();

          if (
            descriptor.bDeviceClass === 6 ||
            (descriptor.bDeviceClass === 0 && this.hasScannerInterface(device))
          ) {
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
        } catch (err) {
          if (err && typeof err === 'object' && 'errno' in err) {
            const error = err as { errno?: number };
            if (error.errno === -12 || error.errno === -5) {
              console.warn(
                `Skipped unsupported USB device (vendorId: ${device.deviceDescriptor?.idVendor})`
              );
            } else {
              console.error('Unexpected USB error:', err);
            }
          } else {
            console.error('Unknown error occurred:', err);
          }
          try {
            device.close();
          } catch {}
          return null;
        }
      })
    );

    return deviceInfos.filter(
      (info): info is NonNullable<typeof info> => info !== null
    );
  }

  public static async scan(device: USBDeviceInfo): Promise<void> {
    const platform = process.platform;

    if (platform === 'win32') {
      return this.scanWithWindows(device);
    } else if (platform === 'darwin') {
      return this.scanWithImageCapture(device); // macOS
    } else if (platform === 'linux') {
      return this.scanWithScanimage(device);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private static async scanWithWindows(device: USBDeviceInfo): Promise<void> {
    // Example using WIA or TWAIN (typically requires native module or wrapper)
    console.log(`Initiating scan on Windows for: ${device.manufacturer}`);
    // Use external command or spawn TWAIN-compatible binary (e.g., NAPS2 CLI)
    throw new Error('Windows scanning is not yet implemented.');
  }

  private static async scanWithImageCapture(
    device: USBDeviceInfo
  ): Promise<void> {
    console.log(`Initiating scan on macOS for: ${device.manufacturer}`);
    try {
      const { stdout } = await execAsync(`imagesnap -w 2 ~/Desktop/scan.jpg`);
      console.log('Scan output:', stdout);
    } catch (err) {
      throw new Error(`macOS scan failed: ${err}`);
    }
  }

  private static async scanWithScanimage(device: USBDeviceInfo): Promise<void> {
    console.log(`Initiating scan on Linux for: ${device.manufacturer}`);
    try {
      const { stdout } = await execAsync(`scanimage --format=png > ~/scan.png`);
      console.log('Scan output:', stdout);
    } catch (err) {
      throw new Error(`Linux scan failed: ${err}`);
    }
  }

  private static hasScannerInterface(device: Device): boolean {
    try {
      const interfaces = device.configDescriptor?.interfaces || [];
      return interfaces.some((iface) =>
        iface.some((intf) => intf.bInterfaceClass === 6)
      );
    } catch {
      return false;
    }
  }

  private static getDescriptorString(
    device: Device,
    index: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!index) return resolve('');
      device.getStringDescriptor(index, (err, data) => {
        if (err) reject(err);
        else resolve(data ?? '');
      });
    });
  }
}
