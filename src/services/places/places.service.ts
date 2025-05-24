// places.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private apiKey = 'AIzaSyDtyUEKZAgXCBiuteyZVvaAaV0OVm-Wydc'; // Move to environment file in production

  constructor(private http: HttpClient) {}

  public getAutocompleteSuggestions(input: string) {
    return this.http.get('http://localhost:3000/api-places/autocomplete', {
      params: { input },
    });
  }
}
