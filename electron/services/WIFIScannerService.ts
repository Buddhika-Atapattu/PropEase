import * as os from 'os';
import * as ping from 'ping';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { reverse } from 'dns';
import * as http from 'http';
import * as https from 'https';
import { OuiParser } from '../utils/oui/ouiParser';

const reverseLookup = promisify(reverse);
const execAsync = promisify(exec);

export interface WiFiScannerDevice {
  ip: string;
  hostname?: string;
  model?: string;
  manufacturer?: string;
  mac?: string;
}

export class WIFIScannerService {
  private subnetPrefix = '';

  constructor() {
    this.detectIP();
  }

  private detectIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name]!) {
        if (net.family === 'IPv4' && !net.internal) {
          this.subnetPrefix =
            net.address.split('.').slice(0, 3).join('.') + '.';
        }
      }
    }
  }

  /**
   * Scans the local network (e.g., 192.168.1.0/24) for reachable devices
   * and extracts human-readable identifiers using hostname, MAC and OUI lookup.
   */
  public async scanForDevices(): Promise<WiFiScannerDevice[]> {
    const devices: WiFiScannerDevice[] = [];

    const pings = Array.from({ length: 254 }, (_, i) => {
      const ip = `${this.subnetPrefix}${i + 1}`;
      return ping.promise
        .probe(ip, { timeout: 1 })
        .then(async (res) => {
          if (res.alive) {
            const hostname = await this.getHostname(ip);
            const mac = await this.getMacAddress(ip);
            const manufacturer = mac
              ? this.getManufacturerFromOUI(mac)
              : undefined;
            // I need to check, is it correct
            if (await WIFIScannerService.checkWebInterface(ip)) {
              devices.push({ ip, hostname, mac, manufacturer });
            }
          }
        })
        .catch(() => {});
    });

    await Promise.all(pings);
    return devices;
  }

  /**
   * Checks if the given device responds to common scanner-related ports (HTTP).
   * Notifies only if the device is reachable and presents a web interface.
   */
  public static async scan(device: WiFiScannerDevice): Promise<void> {
    if (!device.ip) throw new Error('No IP provided for Wi-Fi scanner');

    const reachable = await this.pingScanner(device.ip);
    if (!reachable) throw new Error(`Device at ${device.ip} is unreachable`);

    const hasWebInterface = await this.checkWebInterface(device.ip);
    if (!hasWebInterface)
      throw new Error('Scanner found but no usable interface detected');

    console.log(`Wi-Fi scanner at ${device.ip} responded via HTTP`);
    // Future enhancement: Trigger scanner API or capture endpoint if supported
  }

  private static async pingScanner(ip: string): Promise<boolean> {
    const res = await ping.promise.probe(ip, { timeout: 1 });
    return res.alive;
  }

  private static async checkWebInterface(ip: string): Promise<boolean> {
    const ports = [80, 443, 8080, 8081];
    for (const port of ports) {
      const result = await new Promise<boolean>((resolve) => {
        const options = { host: ip, port, method: 'HEAD', timeout: 2000 };
        const req = (port === 443 ? https : http).request(options, (res) => {
          resolve([200, 401, 403].includes(res.statusCode || 0));
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
        req.end();
      });
      if (result) return true;
    }
    return false;
  }

  private async getHostname(ip: string): Promise<string | undefined> {
    try {
      const hostnames = await reverseLookup(ip);
      return hostnames.length > 0 ? hostnames[0] : undefined;
    } catch {
      return undefined;
    }
  }

  private async getMacAddress(ip: string): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync(`arp -a ${ip}`);
      const match = stdout.match(/(([a-fA-F0-9]{2}[:-]){5}[a-fA-F0-9]{2})/);
      return match ? match[0].replace(/-/g, ':').toLowerCase() : undefined;
    } catch {
      return undefined;
    }
  }

  private getManufacturerFromOUI(mac: string): string | undefined {
    const ouiFilePath = path.join(__dirname, '../assets/oui.txt');
    try {
      const prefix = mac.slice(0, 8).toUpperCase().replace(/:/g, '-');
      const ouiText = fs.readFileSync(ouiFilePath, 'utf8');
      const regex = new RegExp(`^${prefix}.*\\s+(.*?)\\s*$`, 'm');
      const match = ouiText.match(regex);
      return match ? match[1].trim() : undefined;
    } catch {
      return undefined;
    }
  }
}
