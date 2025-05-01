import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  private readonly keyPassword = '@Buddhika#1996@'; // could be a user hash or session value

  // Derive a crypto key from the password
  private async getKey(): Promise<CryptoKey> {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      this.encoder.encode(this.keyPassword),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: this.encoder.encode('my-salt'), // Optional: personalize
        iterations: 100000,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  public async encrypt(data: any): Promise<string> {
    const key = await this.getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // Initialization vector
    const encodedData = this.encoder.encode(JSON.stringify(data));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );

    // Store IV + encrypted data as base64
    return btoa(
      String.fromCharCode(...iv) +
        String.fromCharCode(...new Uint8Array(encrypted))
    );
  }

  public async decrypt(cipherText: string): Promise<any> {
    const rawData = Uint8Array.from(atob(cipherText), (c) => c.charCodeAt(0));
    const iv = rawData.slice(0, 12);
    const encryptedData = rawData.slice(12);
    const key = await this.getKey();

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    const decoded = this.decoder.decode(decrypted);
    return JSON.parse(decoded);
  }
}
