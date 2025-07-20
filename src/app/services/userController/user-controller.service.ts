import {Injectable} from '@angular/core';
import {Router, NavigationStart, UrlTree} from '@angular/router';
import {AuthService} from '../auth/auth.service';
import {filter} from 'rxjs/operators';
import {parsePhoneNumberFromString} from 'libphonenumber-js';
import {firstValueFrom} from 'rxjs';
import {HttpClient, HttpParams} from '@angular/common/http';

export interface MSG {
  status: string;
  message: string;
  data: any;
}

@Injectable({
  providedIn: 'root',
})
export class UserControllerService {
  constructor (
    private router: Router,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  public isPhoneNumberValid(number: string): boolean {
    const phoneNumber = parsePhoneNumberFromString(number.trim());
    return phoneNumber?.isValid() ?? false;
  }

  //<================================================================ API ================================================================>
  public async emailValidator(email: string): Promise<MSG> {
    return await firstValueFrom(
      this.http.get<MSG>(
        `http://localhost:3000/api-validator/email-validator/:${email}`
      )
    );
  }

  public async convertToPDF(fileUrl: string): Promise<Blob> {
    return await firstValueFrom(
      this.http.post(`http://localhost:3000/api-file-transfer/convert-to-pdf`,
        {fileUrl},
        {responseType: 'blob'} // Important: expect binary PDF data
      )
    );
  }
  //<================================================================ END API ================================================================>
}
