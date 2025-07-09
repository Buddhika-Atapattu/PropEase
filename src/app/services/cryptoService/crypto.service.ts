import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  private readonly isBrowser: boolean;
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();
  private readonly keyPassword = '@Buddhika#1996@'; // Replace with a dynamic user-specific value for better security

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /**
   * Derives a cryptographic AES-GCM key from a static password using PBKDF2.
   */
  private async getKey(): Promise<CryptoKey | null> {
    if (!this.isBrowser) return null;

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
        salt: this.encoder.encode('my-salt'), // Optional salt
        iterations: 100000,
        hash: 'SHA-256',
      },
      baseKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts a JavaScript object or string and returns a base64 string.
   */
  public async encrypt(data: any): Promise<string | null> {
    if (!this.isBrowser || data === null) return null;

    const key = await this.getKey();
    if (!key) return null;

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = this.encoder.encode(JSON.stringify(data));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );

    const encryptedBytes = new Uint8Array(encrypted);

    // Extract authTag manually (last 16 bytes)
    const authTag = encryptedBytes.slice(encryptedBytes.length - 16);
    const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 16);

    // Combine iv + authTag + ciphertext to match backend
    const combined = new Uint8Array(
      iv.length + authTag.length + ciphertext.length
    );
    combined.set(iv, 0);
    combined.set(authTag, iv.length);
    combined.set(ciphertext, iv.length + authTag.length);

    const base64 = btoa(String.fromCharCode(...combined));

    return base64.replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/, '');
  }

  /**
   * Decrypts a base64 string back into its original object or string form.
   */
  public async decrypt(cipherText: string): Promise<any | null> {
    if (!this.isBrowser || !cipherText) return null;

    const key = await this.getKey();
    if (!key) return null;

    const padded = cipherText
      .replace(/_/g, '/')
      .replace(/-/g, '+')
      .padEnd(cipherText.length + ((4 - (cipherText.length % 4)) % 4), '=');

    const rawData = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));

    const iv = rawData.slice(0, 12);
    const authTag = rawData.slice(12, 28);
    const ciphertext = rawData.slice(28);

    // Reconstruct encrypted data in format WebCrypto expects: ciphertext + authTag
    const encryptedWithTag = new Uint8Array(ciphertext.length + authTag.length);
    encryptedWithTag.set(ciphertext);
    encryptedWithTag.set(authTag, ciphertext.length);

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedWithTag
      );
      return JSON.parse(this.decoder.decode(decrypted));
    } catch (e) {
      console.error('Decryption failed:', e);
      return null;
    }
  }

  /**
   * Generates a secure email verification token with 24-hour expiry.
   */
  public generateEmailVerificationToken(): { token: string; expires: Date } {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);

    const token = Array.from(array, (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return { token, expires };
  }
}
