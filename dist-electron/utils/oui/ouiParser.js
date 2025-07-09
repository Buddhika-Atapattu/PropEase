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
exports.OuiParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class OuiParser {
    static parsed = [];
    static loadOuiFile() {
        const filePath = path.join(__dirname, '../oui.txt');
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
            const match = line.match(/^([0-9A-F]{6})\s+\(base 16\)\s+(.+)$/i);
            if (match) {
                const prefix = match[1].toUpperCase().match(/.{1,2}/g).join(':');
                const organization = match[2].trim();
                this.parsed.push({ prefix, organization });
            }
        }
    }
    static lookup(mac) {
        const prefix = mac.toUpperCase().substring(0, 8); // e.g., "00:1A:2B"
        return this.parsed.find((entry) => entry.prefix === prefix)?.organization;
    }
}
exports.OuiParser = OuiParser;
