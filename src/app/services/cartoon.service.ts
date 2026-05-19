import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CartoonSeries {
  id: string;
  name: string;
  originalName: string;
  coverUrl: string;
  description: string;
  tags: string[];
  rating: number;
  episodesCount: string;
  category: string;
}

export interface CartoonEpisode {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string;
  linkEmbed: string;
  linkM3u8: string;
  duration: string;
  views: string;
  publishDate: string;
}

@Injectable({
  providedIn: 'root',
  })
export class CartoonService {
  private apiUrl = `${environment.apiUrl}/cartoon`;

  constructor(private http: HttpClient) {}

  getSeriesList(): Observable<{ status: number; data: CartoonSeries[] }> {
    return this.http.get<{ status: number; data: CartoonSeries[] }>(`${this.apiUrl}/series`);
  }

  getEpisodes(
    seriesId: string,
    keyword?: string
  ): Observable<{ status: number; data: CartoonEpisode[] }> {
    let url = `${this.apiUrl}/episodes?seriesId=${encodeURIComponent(seriesId)}`;
    if (keyword && keyword.trim()) {
      url += `&keyword=${encodeURIComponent(keyword.trim())}`;
    }
    return this.http.get<{ status: number; data: CartoonEpisode[] }>(url);
  }

  getEpisodeEmbed(slug: string): Observable<{ linkEmbed: string; linkM3u8: string }> {
    return this.http.get<{ linkEmbed: string; linkM3u8: string }>(
      `${this.apiUrl}/episode-embed?slug=${encodeURIComponent(slug)}`
    );
  }
}
