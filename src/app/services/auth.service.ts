import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  avatar?: string;
  provider: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private googleLoginSubject = new Subject<{
    token?: string;
    error?: string;
  }>();
  public googleLogin$ = this.googleLoginSubject.asObservable();

  private authChannel?: BroadcastChannel;

  constructor(private http: HttpClient) {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      this.currentUserSubject.next(JSON.parse(savedUser));
    }

    // 1. Listen for messages via BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      this.authChannel = new BroadcastChannel('google-auth-channel');
      this.authChannel.onmessage = (event) => {
        console.log('Received Google Login via BroadcastChannel:', event.data);
        this.googleLoginSubject.next(event.data);
      };
    }

    // 2. Fallback: Listen for messages via localStorage (Storage Event)
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === 'google-auth-result' && event.newValue) {
          try {
            const result = JSON.parse(event.newValue);
            console.log('Received Google Login via StorageEvent:', result);
            this.googleLoginSubject.next(result);
            // Optional: clean up to avoid triggering again
            localStorage.removeItem('google-auth-result');
          } catch (e) {
            console.error('Error parsing google-auth-result', e);
          }
        }
      });
    }
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return !!this.currentUserValue;
  }

  signin(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/signin`, data).pipe(
      tap((response) => {
        if (response.status === 200 && response.data.user) {
          this.saveUser(response.data.user, response.data.access_token);
        }
      }),
    );
  }

  private saveUser(user: User, token: string) {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    this.currentUserSubject.next(user);
  }

  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
  }

  signup(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/signup`, data);
  }

  verifyOtp(data: { email: string; otpCode: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify-otp`, data);
  }

  resendOtp(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/resend-otp`, { email });
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, data);
  }

  changePassword(data: any): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post(`${this.apiUrl}/change-password`, data, { headers });
  }

  updateProfile(formData: FormData): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http
      .post(`${this.apiUrl}/update-profile`, formData, { headers })
      .pipe(
        tap((res: any) => {
          if (res.status === 200 && res.data) {
            const user = res.data;
            localStorage.setItem('user', JSON.stringify(user));
            this.currentUserSubject.next(user);
          }
        }),
      );
  }

  getProfile(): Observable<any> {
    const token = localStorage.getItem('token');
    if (!token) return new Observable((obs) => obs.error('No token'));

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.get<any>(`${this.apiUrl}/me`, { headers }).pipe(
      tap((response) => {
        if (response.status === 200 && response.data) {
          localStorage.setItem('user', JSON.stringify(response.data));
          this.currentUserSubject.next(response.data);
        }
      }),
    );
  }

  openGoogleLoginPopup() {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open(
      `${environment.apiUrl}/auth/google`,
      'google-login-popup',
      `width=${width},height=${height},left=${left},top=${top}`,
    );
  }

  notifyGoogleLogin(token?: string, error?: string) {
    const result = { token, error, timestamp: Date.now() };
    console.log('Notifying Google Login Result:', result);

    // 1. BroadcastChannel
    if (this.authChannel) {
      this.authChannel.postMessage(result);
    }

    // 2. Storage Event fallback
    localStorage.setItem('google-auth-result', JSON.stringify(result));

    // Cleanup storage immediately to keep it clean,
    // but the listener should have triggered already if same origin
    setTimeout(() => localStorage.removeItem('google-auth-result'), 1000);
  }
}
