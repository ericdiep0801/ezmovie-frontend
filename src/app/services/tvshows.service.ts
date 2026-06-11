import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TvShowDto {
  id: string;
  name: string;
  type: string;
  coverUrl: string;
  previewUrl: string;
  description: string;
  popularity: number;
  episodes: number;
  rating: string;
}

@Injectable({
  providedIn: 'root'
})
export class TvShowsService {
  private apiUrl = `${environment.apiUrl}/tvshows`;

  constructor(private http: HttpClient) {}

  getTopShows(): Observable<{ status: number; data: TvShowDto[] }> {
    return this.http.get<{ status: number; data: TvShowDto[] }>(`${this.apiUrl}/top`).pipe(
      catchError(err => {
        console.error('Error fetching TV shows', err);
        return of({ status: 500, data: [] });
      })
    );
  }
}
