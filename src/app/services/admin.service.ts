import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TableInfo {
  name: string;
  columns: {
    name: string;
    type: any;
    isPrimary: boolean;
    isNullable: boolean;
  }[];
  relations?: {
    property: string;
    joinColumns: string[];
    targetTable: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  getDashboardStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dashboard-stats`, { headers: this.getHeaders() });
  }

  getTables(): Observable<TableInfo[]> {
    return this.http.get<TableInfo[]>(`${this.apiUrl}/tables`, { headers: this.getHeaders() });
  }

  getTableData(table: string, page: number = 1, limit: number = 20, search: string = '', filters: any = {}): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    
    if (search) {
      params = params.set('search', search);
    }
    
    const filterKeys = Object.keys(filters).filter(k => filters[k] !== '' && filters[k] !== null);
    if (filterKeys.length > 0) {
      const activeFilters: any = {};
      filterKeys.forEach(k => activeFilters[k] = filters[k]);
      params = params.set('filters', JSON.stringify(activeFilters));
    }

    return this.http.get<any>(`${this.apiUrl}/data/${table}`, { headers: this.getHeaders(), params });
  }

  insertData(table: string, data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/data/${table}`, data, { headers: this.getHeaders() });
  }

  updateData(table: string, id: any, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/data/${table}/${id}`, data, { headers: this.getHeaders() });
  }

  deleteData(table: string, id: any): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/data/${table}/${id}`, { headers: this.getHeaders() });
  }

  batchDelete(table: string, ids: any[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/data/${table}/batch-delete`, { ids }, { headers: this.getHeaders() });
  }

  batchInsert(table: string, data: any[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/data/${table}/batch-insert`, { data }, { headers: this.getHeaders() });
  }
}
