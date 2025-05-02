import { Injectable } from '@angular/core';
import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { firstValueFrom, Subscription, pipe, take } from 'rxjs';
import { CryptoService } from '../cryptoService/crypto.service';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

export interface UserCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface Address {
  street: string;
  houseNumber: string;
  city: string;
  postcode: string;
  country?: string;
  stateOrProvince?: string;
}

export interface Role {
  role: 'admin' | 'agent' | 'tenant' | 'operator' | 'developer' | 'user';
}

export interface BaseUser {
  __id?: string;
  __v?: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  username: string;
  email: string;
  age: number;
  image?: string | File;
  phoneNumber?: string;
  role: Role;
  address: Address;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewUser extends BaseUser {
  password: string;
}

export interface UsersType extends NewUser {}

export interface LoggedUserType extends Omit<NewUser, 'password'> {}

@Injectable({
  providedIn: 'root',
})
export class APIsService {
  private isBrowser: boolean;
  constructor(
    private cryptoService: CryptoService,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  public async getAllUsers(): Promise<any> {
    return (
      (await firstValueFrom(
        this.http.get<UsersType[]>('http://localhost:3000/users')
      )) || null
    );
  }

  public async verifyUser(user: UserCredentials): Promise<any> {
    return (
      (await firstValueFrom(
        this.http.post<LoggedUserType>(
          'http://localhost:3000/verify-user',
          user
        )
      )) || null
    );
  }
}
