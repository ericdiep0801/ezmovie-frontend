import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  coverUrl: string;
  previewUrl: string;
  durationMs: number;
  embedUrl: string;
  popularity: number;
  genre: string;
  isLocked?: boolean; // True if unplayable/unavailable
}

@Injectable({
  providedIn: 'root',
})
export class MusicService {
  private apiUrl = `${environment.apiUrl}/music`;

  constructor(private http: HttpClient) {}

  getTrendingTracks(): Observable<{ status: number; data: Track[] }> {
    return this.http.get<{ status: number; data: Track[] }>(`${this.apiUrl}/trending`);
  }

  searchTracks(keyword: string): Observable<{ status: number; data: Track[] }> {
    return this.http.get<{ status: number; data: Track[] }>(
      `${this.apiUrl}/search?keyword=${encodeURIComponent(keyword)}`
    );
  }
}
