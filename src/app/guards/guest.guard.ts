import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class GuestGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.authService.currentUser$.pipe(
      take(1),
      map(user => {
        if (user) {
          // If user is logged in, redirect to home
          return this.router.createUrlTree(['/home']);
        }
        // If not logged in, allow access to auth pages
        return true;
      })
    );
  }
}
