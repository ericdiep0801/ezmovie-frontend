import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LiveDto {
  id: string;
  name: string;
  channel: string;
  coverUrl: string;
  previewUrl: string;
  durationMs: number;
  embedUrl: string;
  popularity: number;
}

@Injectable({
  providedIn: 'root'
})
export class LiveService {
  private apiUrl = `${environment.apiUrl}/live`;

  constructor(private http: HttpClient) { }

  getLivePageants(): Observable<{ status: number; data: LiveDto[] }> {
    return this.http.get<{ status: number; data: LiveDto[] }>(`${this.apiUrl}/pageants`);
  }
}
