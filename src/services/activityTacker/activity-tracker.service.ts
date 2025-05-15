import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { filter } from 'rxjs/operators';
import { AuthService, BaseUser, LoggedUserType } from '../auth/auth.service';
import { firstValueFrom, Subscription, pipe, take } from 'rxjs';
import { CryptoService } from '../cryptoService/crypto.service';

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

  public async getLoggedUserTracking(
    username: string,
    start: number,
    limit: number
  ): Promise<MSG> {
    return await firstValueFrom(
      this.http.get<MSG>(
        `http://localhost:3000/api-tracking/get-logged-user-tracking/${username}/${start}/${limit}`
      )
    );
  }
}
