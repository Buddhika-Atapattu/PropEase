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
exports.WIFIScannerService = void 0;
const os = __importStar(require("os"));
const ping = __importStar(require("ping"));
const util_1 = require("util");
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dns_1 = require("dns");
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const reverseLookup = (0, util_1.promisify)(dns_1.reverse);
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class WIFIScannerService {
    subnetPrefix = '';
    constructor() {
        this.detectIP();
    }
    detectIP() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const net of interfaces[name]) {
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
    async scanForDevices() {
        const devices = [];
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
                .catch(() => { });
        });
        await Promise.all(pings);
        return devices;
    }
    /**
     * Checks if the given device responds to common scanner-related ports (HTTP).
     * Notifies only if the device is reachable and presents a web interface.
     */
    static async scan(device) {
        if (!device.ip)
            throw new Error('No IP provided for Wi-Fi scanner');
        const reachable = await this.pingScanner(device.ip);
        if (!reachable)
            throw new Error(`Device at ${device.ip} is unreachable`);
        const hasWebInterface = await this.checkWebInterface(device.ip);
        if (!hasWebInterface)
            throw new Error('Scanner found but no usable interface detected');
        console.log(`Wi-Fi scanner at ${device.ip} responded via HTTP`);
        // Future enhancement: Trigger scanner API or capture endpoint if supported
    }
    static async pingScanner(ip) {
        const res = await ping.promise.probe(ip, { timeout: 1 });
        return res.alive;
    }
    static async checkWebInterface(ip) {
        const ports = [80, 443, 8080, 8081];
        for (const port of ports) {
            const result = await new Promise((resolve) => {
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
            if (result)
                return true;
        }
        return false;
    }
    async getHostname(ip) {
        try {
            const hostnames = await reverseLookup(ip);
            return hostnames.length > 0 ? hostnames[0] : undefined;
        }
        catch {
            return undefined;
        }
    }
    async getMacAddress(ip) {
        try {
            const { stdout } = await execAsync(`arp -a ${ip}`);
            const match = stdout.match(/(([a-fA-F0-9]{2}[:-]){5}[a-fA-F0-9]{2})/);
            return match ? match[0].replace(/-/g, ':').toLowerCase() : undefined;
        }
        catch {
            return undefined;
        }
    }
    getManufacturerFromOUI(mac) {
        const ouiFilePath = path.join(__dirname, '../assets/oui.txt');
        try {
            const prefix = mac.slice(0, 8).toUpperCase().replace(/:/g, '-');
            const ouiText = fs.readFileSync(ouiFilePath, 'utf8');
            const regex = new RegExp(`^${prefix}.*\\s+(.*?)\\s*$`, 'm');
            const match = ouiText.match(regex);
            return match ? match[1].trim() : undefined;
        }
        catch {
            return undefined;
        }
    }
}
exports.WIFIScannerService = WIFIScannerService;
