import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TvService {
  private apiUrl = `${environment.apiUrl}/tv`;

  // Reactive subjects to sync states across the application in real-time
  public tvFavoriteUpdated$ = new Subject<void>();
  public tvHistoryUpdated$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  // 1. Get TV channels list (optional filters: category, keyword)
  getChannels(category?: string, keyword?: string): Observable<any> {
    let url = `${this.apiUrl}/channels`;
    const params: string[] = [];
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    // Supports passing authorization headers optionally for checking favorite status
    const token = localStorage.getItem('token');
    if (token) {
      return this.http.get<any>(url, { headers: this.getHeaders() });
    }
    return this.http.get<any>(url);
  }

  // 2. Get distinct TV categories
  getCategories(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/categories`);
  }

  // 3. Get channel details & EPG (supports optional token to return favorites status)
  getChannelBySlug(slug: string): Observable<any> {
    const token = localStorage.getItem('token');
    if (token) {
      return this.http.get<any>(`${this.apiUrl}/channels/detail/${slug}`, { headers: this.getHeaders() });
    }
    return this.http.get<any>(`${this.apiUrl}/channels/detail/${slug}`);
  }

  // 4. Toggle favorite channel status (Authenticated)
  toggleFavorite(channelId: number): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/favorite/toggle`, { channelId }, { headers: this.getHeaders() })
      .pipe(tap(() => this.tvFavoriteUpdated$.next()));
  }

  // 5. Get list of user's favorite channels (Authenticated)
  listFavorites(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/favorites`, { headers: this.getHeaders() });
  }

  // 6. Log watch history for a channel (Authenticated)
  addWatchHistory(channelId: number): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/history`, { channelId }, { headers: this.getHeaders() })
      .pipe(tap(() => this.tvHistoryUpdated$.next()));
  }

  // 7. Get watch history of channels (Authenticated)
  listWatchHistory(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/history`, { headers: this.getHeaders() });
  }

  // 8. Clear TV watch history (Authenticated)
  clearWatchHistory(): Observable<any> {
    return this.http
      .delete<any>(`${this.apiUrl}/history`, { headers: this.getHeaders() })
      .pipe(tap(() => this.tvHistoryUpdated$.next()));
  }

  // 9. Sync/Import dynamic IPTV playlist (M3U URL)
  syncFromM3u(url: string, cleanExisting: boolean = false): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/sync`, { url, cleanExisting });
  }
}
