import { Injectable } from '@angular/core';

interface fileType {
  destination: string;
  encoding: string;
  fieldname: string;
  filename: string;
  mimetype: string;
  originalname: string;
  path: string;
  size: number;
}

@Injectable({
  providedIn: 'root',
})
export class TokenService {
  private _mobileTenantFileUploadToken: string = '';
  private _mobileTenantFileUploadTokenFileData: fileType | null = null;
  private _mobileTenantFileUploadTokenFileDataURL: string = '';

  constructor() {}

  get mobileTenantFileUploadToken(): string {
    return this._mobileTenantFileUploadToken;
  }

  set mobileTenantFileUploadToken(val: string) {
    this._mobileTenantFileUploadToken = val;
  }

  get mobileTenantFileUploadTokenFileData(): fileType | null {
    return this._mobileTenantFileUploadTokenFileData;
  }
  
  set mobileTenantFileUploadTokenFileData(val: fileType | null) {
    this._mobileTenantFileUploadTokenFileData = val;
  }

  get mobileTenantFileUploadTokenFileDataURL(): string {
    return this._mobileTenantFileUploadTokenFileDataURL;
  }

  set mobileTenantFileUploadTokenFileDataURL(val: string) {
    this._mobileTenantFileUploadTokenFileDataURL = val;
  }
}
