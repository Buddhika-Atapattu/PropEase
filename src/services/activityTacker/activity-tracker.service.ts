import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { filter } from 'rxjs/operators';
import { AuthService, BaseUser, LoggedUserType } from '../auth/auth.service';
import { firstValueFrom, Subscription, pipe, take } from 'rxjs';
import { CryptoService } from '../cryptoService/crypto.service';
import * as moment from 'moment';

export interface MSG {
  status: string;
  message: string;
  data: any;
}

@Injectable({
  providedIn: 'root',
})
export class ActivityTrackerService {
  private user: LoggedUserType | null = null;
  private loggedTime: Date | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  set userLoggedTime(time: Date | null) {
    this.loggedTime = time;
  }

  get userLoggedTime(): Date | null {
    return this.loggedTime;
  }

  set loggedUser(user: LoggedUserType | null) {
    this.user = user;
  }

  get loggedUser(): LoggedUserType | null {
    return this.user;
  }

  //<========== API GOSE UNDER THIS SECTION ==========>
  public async saveLoggedUserDataToTracking(data: any): Promise<MSG> {
    return await firstValueFrom(
      this.http.post<MSG>(
        'http://localhost:3000/api-tracking/track-logged-user-login',
        data
      )
    );
  }

  private formatDateOnly(date: moment.Moment | Date | string): string {
    // If it's a Moment object
    if (moment.isMoment(date)) {
      return date.format('YYYY-MM-DD');
    }

    // If it's a native Date or string
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      throw new Error('Invalid date provided to formatDateOnly');
    }

    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  public async getLoggedUserTracking(
    username: string,
    start: number,
    limit: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<MSG> {
    let URL = `http://localhost:3000/api-tracking/get-logged-user-tracking/${username}/${start}/${limit}`;

    const queryParams: string[] = [];
    if (startDate)
      queryParams.push(`startDate=${this.formatDateOnly(startDate)}`);
    if (endDate) queryParams.push(`endDate=${this.formatDateOnly(endDate)}`);
    if (queryParams.length > 0) {
      URL += `?${queryParams.join('&')}`;
    }

    return await firstValueFrom(this.http.get<MSG>(URL));
  }

  public async getLoggedAllUsersTracking(): Promise<MSG> {
    return await firstValueFrom(
      this.http.get<MSG>(
        `http://localhost:3000/api-tracking/get-all-users-login-counts`
      )
    );
  }
}
