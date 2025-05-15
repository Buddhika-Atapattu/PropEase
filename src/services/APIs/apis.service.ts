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
import { HttpClient, HttpParams } from '@angular/common/http';
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

export interface PermissionEntry {
  module: string;
  actions: string[];
}

export interface ROLE_ACCESS_MAP {
  role: string;
  permissions: PermissionEntry[];
}

export type Role =
  | 'admin'
  | 'agent'
  | 'tenant'
  | 'owner'
  | 'operator'
  | 'manager'
  | 'developer'
  | 'user';

export interface BaseUser {
  __id?: string;
  __v?: number;
  name: string;
  username: string;
  email: string;
  dateOfBirth?: Date | null;
  age: number;
  bio: string;
  image?: string | File;
  phoneNumber?: string;
  role:
    | 'admin'
    | 'agent'
    | 'tenant'
    | 'owner'
    | 'operator'
    | 'manager'
    | 'developer'
    | 'user';
  gender: string;
  address: Address;
  isActive: boolean;
  access: ROLE_ACCESS_MAP;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewUser extends BaseUser {
  password: string;
}

export interface UsersType extends NewUser {}

export interface UpdateUserType extends Omit<BaseUser, 'createdAt'> {}

export interface LoggedUserType extends Omit<NewUser, 'password'> {}

export type AccessMap = {
  [module: string]: string[]; // list of actions allowed
};

export interface MSG_DATA_TYPE extends UpdateUserType {
  status: string;
  message: string;
  user: UpdateUserType;
  token: string;
}

export interface MSG_WITH_BASEUSER {
  status: string;
  message: string;
  user: BaseUser;
  data: any;
}

export interface validateType {
  status: string;
  user: UsersType;
}

export interface UDER_DOC_TYPES extends MSG_WITH_BASEUSER {
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  path: string;
  URL: string;
  extension: string;
  uploadDate: Date;
  download: string;
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

  public async getAllUsers(): Promise<UsersType[] | null> {
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

  public async getCountries(): Promise<string> {
    const countries = await firstValueFrom(
      this.http.get<Country[]>(
        'https://cdn.jsdelivr.net/npm/country-flag-emoji-json@2.0.0/dist/index.json'
      )
    );
    return JSON.stringify(countries) || '';
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

  public async getAllUsersWithPagination(
    start: number,
    limit: number,
    search?: string
  ): Promise<any> {
    let params = new HttpParams();
    if (search !== undefined) {
      params = params.set('search', search.trim());
    }
    return await firstValueFrom(
      this.http.get<object | null>(
        `http://localhost:3000/api-user/users-with-pagination/${start}/${limit}`,
        { params }
      )
    )
      .then((data) => {
        return data;
      })
      .catch((error) => {
        console.error(error);
        return null;
      });
  }

  public async getUserByUsername(username: string): Promise<validateType> {
    return await firstValueFrom(
      this.http.get<validateType>(
        `http://localhost:3000/api-user/user-username/${username}`
      )
    );
  }

  public async getUserByEmail(email: string): Promise<validateType> {
    return await firstValueFrom(
      this.http.get<validateType>(
        `http://localhost:3000/api-user/user-email/${email}`
      )
    );
  }

  public async getUserByPhone(phone: string): Promise<validateType> {
    return await firstValueFrom(
      this.http.get<validateType>(
        `http://localhost:3000/api-user/user-phone/${phone}`
      )
    );
  }

  public async createNewUser(data: FormData): Promise<MSG_DATA_TYPE> {
    return await firstValueFrom(
      this.http.post<MSG_DATA_TYPE>(
        'http://localhost:3000/api-user/create-user',
        data
      )
    );
  }

  public async generateToken(username: string): Promise<MSG_DATA_TYPE> {
    return await firstValueFrom(
      this.http.post<MSG_DATA_TYPE>(
        'http://localhost:3000/api-user/generate-token',
        { username }
      )
    );
  }

  public async uploadDocuments(
    data: FormData,
    username: string
  ): Promise<MSG_WITH_BASEUSER> {
    return await firstValueFrom(
      this.http.post<MSG_WITH_BASEUSER>(
        `http://localhost:3000/api-user/user-document-upload/${username}`,
        data
      )
    );
  }

  public async getUserByToken(token: string): Promise<MSG_WITH_BASEUSER> {
    return await firstValueFrom(
      this.http.get<MSG_WITH_BASEUSER>(
        `http://localhost:3000/api-user/user-token/${token}`
      )
    );
  }

  public async getUserDocuments(username: string): Promise<UDER_DOC_TYPES> {
    return await firstValueFrom(
      this.http.get<UDER_DOC_TYPES>(
        `http://localhost:3000/api-user/uploads/${username}/documents`
      )
    );
  }

}
