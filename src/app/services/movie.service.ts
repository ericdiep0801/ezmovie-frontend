import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MovieService {
  private apiUrl = `${environment.apiUrl}/movies`;

  // Reactive subjects to sync states across different components in real-time
  public favoriteUpdated$ = new Subject<void>();
  public historyUpdated$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  // 1. Get list of new movies (paginated)
  getMovies(page: number = 1, limit: number = 100): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}?page=${page}&limit=${limit}`);
  }

  // 2. Search movies by keyword
  searchMovies(
    keyword: string,
    page: number = 1,
    limit: number = 100,
  ): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/search?keyword=${encodeURIComponent(keyword)}&page=${page}&limit=${limit}`,
    );
  }

  // 3. Movie details
  getMovieDetails(slug: string): Observable<any> {
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return this.http.get<any>(`${this.apiUrl}/detail/${slug}`, { headers });
  }

  // 4. Watch movie (just get streaming links)
  watchMovie(slug: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/watch/${slug}`);
  }

  // 5. Toggle favorite status (Authenticated)
  toggleFavorite(dto: {
    movieSlug: string;
    movieName?: string;
    moviePoster?: string;
    movieType?: string;
  }): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/favorite/toggle`, dto, {
        headers: this.getHeaders(),
      })
      .pipe(tap(() => this.favoriteUpdated$.next()));
  }

  // Add to favorites (Authenticated)
  addFavorite(dto: {
    movieSlug: string;
    movieName: string;
    moviePoster?: string;
    movieType?: string;
  }): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/favorite`, dto, { headers: this.getHeaders() })
      .pipe(tap(() => this.favoriteUpdated$.next()));
  }

  // Remove from favorites (Authenticated)
  removeFavorite(slug: string): Observable<any> {
    return this.http
      .delete<any>(`${this.apiUrl}/favorite/${slug}`, {
        headers: this.getHeaders(),
      })
      .pipe(tap(() => this.favoriteUpdated$.next()));
  }

  // List favorites (Authenticated)
  listFavorites(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/favorites`, {
      headers: this.getHeaders(),
    });
  }

  // Check if movie is favorited (Authenticated)
  checkFavorite(slug: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/favorite/check/${slug}`, {
      headers: this.getHeaders(),
    });
  }

  // 6. Watch History (Authenticated)
  addWatchHistory(dto: {
    movieSlug: string;
    movieName: string;
    moviePoster?: string;
    episodeName: string;
    episodeSlug: string;
  }): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/history`, dto, { headers: this.getHeaders() })
      .pipe(tap(() => this.historyUpdated$.next()));
  }

  // List watch history (Authenticated)
  listWatchHistory(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/history`, {
      headers: this.getHeaders(),
    });
  }

  // Clear watch history (Authenticated)
  clearWatchHistory(): Observable<any> {
    return this.http
      .delete<any>(`${this.apiUrl}/history`, { headers: this.getHeaders() })
      .pipe(tap(() => this.historyUpdated$.next()));
  }

  // Delete individual watch history item (Authenticated)
  deleteWatchHistoryItem(slug: string): Observable<any> {
    return this.http
      .delete<any>(`${this.apiUrl}/history/${slug}`, {
        headers: this.getHeaders(),
      })
      .pipe(tap(() => this.historyUpdated$.next()));
  }

  // Reactive trigger to manually refresh favorite components
  triggerFavoriteUpdate() {
    this.favoriteUpdated$.next();
  }

  // 7. Comments System APIs
  addComment(movieSlug: string, content: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/comments`,
      { movieSlug, content },
      { headers: this.getHeaders() },
    );
  }

  listComments(movieSlug: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/comments/${movieSlug}`, {
      headers: this.getHeaders(),
    });
  }

  toggleLikeComment(commentId: number): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/comments/${commentId}/like`,
      {},
      { headers: this.getHeaders() },
    );
  }
}
