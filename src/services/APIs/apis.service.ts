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

export interface Country {
  name: string;
  code: string;
  emoji: string;
  unicode: string;
  image: string;
}

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
  middleName?: string | null;
  lastName: string;
  username: string;
  email: string;
  dateOfBirth?: Date | null;
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

export interface UpdateUserType extends Omit<BaseUser, 'createdAt'> {}

export interface LoggedUserType extends Omit<NewUser, 'password'> {}

export interface MSG_DATA_TYPE extends UpdateUserType {
  status: string;
  message: string;
  user: UpdateUserType;
}
@Injectable({
  providedIn: 'root',
})
export class APIsService {
  private isBrowser: boolean;
  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  public async getAllUsers(): Promise<any> {
    return (
      (await firstValueFrom(
        this.http.get<UsersType[]>('http://localhost:3000/api-user/users')
      )) || null
    );
  }

  public async verifyUser(user: UserCredentials): Promise<any> {
    return (
      (await firstValueFrom(
        this.http.post<LoggedUserType>(
          'http://localhost:3000/api-user/verify-user',
          user
        )
      )) || null
    );
  }

  public async getCountries(): Promise<Country[] | null> {
    return (
      (await firstValueFrom(
        this.http.get<Country[]>(
          'https://cdn.jsdelivr.net/npm/country-flag-emoji-json@2.0.0/dist/index.json'
        )
      )) || null
    );
  }

  public async updateUser(
    user: FormData,
    username: UserCredentials['username']
  ): Promise<MSG_DATA_TYPE | null> {
    if (username) {
      const data = await firstValueFrom(
        this.http.put<MSG_DATA_TYPE>(
          `http://localhost:3000/api-user/user-update/${username}`,
          user
        )
      );
      return data;
    } else {
      return null;
    }
  }
}
