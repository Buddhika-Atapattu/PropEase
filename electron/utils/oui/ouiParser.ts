import * as fs from 'fs';
import * as path from 'path';

interface OuiEntry {
  prefix: string; // e.g., 00:1A:2B
  organization: string;
}


export class OuiParser {
  private static parsed: OuiEntry[] = [];

  static loadOuiFile() {
    const filePath = path.join(__dirname, '../oui.txt');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^([0-9A-F]{6})\s+\(base 16\)\s+(.+)$/i);
      if (match) {
        const prefix = match[1].toUpperCase().match(/.{1,2}/g)!.join(':');
        const organization = match[2].trim();
        this.parsed.push({ prefix, organization });
      }
    }
  }

  static lookup(mac: string): string | undefined {
    const prefix = mac.toUpperCase().substring(0, 8); // e.g., "00:1A:2B"
    return this.parsed.find((entry) => entry.prefix === prefix)?.organization;
  }
}