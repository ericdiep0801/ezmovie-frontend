import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { LoadingService } from '../../services/loading.service';
import { AuthService } from '../../services/auth.service';
import { PopupService } from '../../services/popup.service';
import { OtpService } from '../../services/otp.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit, OnDestroy {
  public loginForm: FormGroup;
  public isSubmitted: boolean = false;
  private verifiedSub?: Subscription;
  private isAutoLogin: boolean = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private loadingService: LoadingService,
    private authService: AuthService,
    private popupService: PopupService,
    private otpService: OtpService,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/,
          ),
        ],
      ],
    });
  }

  public getErrorMessage(controlName: string): string {
    const control = this.loginForm.get(controlName);
    if (control && (control.touched || control.dirty) && control.errors) {
      if (control.errors['required']) {
        const labels: { [key: string]: string } = {
          email: 'Email address',
          password: 'Password',
        };
        return `${labels[controlName] || 'This field'} is required`;
      }
      if (control.errors['email']) return 'Invalid email address';
      if (control.errors['minlength'])
        return `Minimum length is ${control.errors['minlength'].requiredLength}`;
      if (control.errors['pattern'] && controlName === 'password') {
        return 'Must contain at least 8 chars, 1 uppercase, 1 lowercase, 1 number, and 1 special char';
      }
    }
    return '';
  }

  public isFieldValid(controlName: string): boolean | null {
    const control = this.loginForm.get(controlName);
    if (!control) return null;

    // Chỉ hiện icon nếu:
    // 1. Đã bấm nút Sign In (isSubmitted)
    // 2. Hoặc đã gõ dữ liệu (dirty) VÀ đã chạm vào (touched)
    if (this.isSubmitted || (control.dirty && control.touched)) {
      if (control.valid) {
        return control.value ? true : null;
      }
      return false;
    }

    return null;
  }

  private messageListener = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.data.type === 'google-login-result') {
      this.processGoogleLoginResult(event.data);
    }
  };

  ngOnInit() {
    // 1. Check if we are inside a popup window (the callback part)
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      const error = params['error'];

      if (token || error) {
        // Detect if we are in a popup (check query param, opener, or window name)
        const isPopup = params['isPopup'] === 'true' || (window.opener && window.opener !== window) || window.name === 'google-login-popup';
        
        if (isPopup) {
          console.log('Popup detected, sending results and closing...', { token: !!token, error });
          // Send data back to the main window and close.
          if (window.opener) {
            console.log('Sending via postMessage to opener');
            window.opener.postMessage({ type: 'google-login-result', token, error }, window.location.origin);
          }
          
          // Use BroadcastChannel and StorageEvent as robust fallbacks
          this.authService.notifyGoogleLogin(token, error);
          
          // Force close the popup
          console.log('Closing window now');
          window.close();
          
          // Fallback for some browsers where window.close() might be blocked
          setTimeout(() => {
            console.log('Fallback closing window');
            window.close();
          }, 500);
          return;
        }
        
        // If not in popup (fallback), handle normally
        if (token) {
          this.handleLoginSuccess(token);
        } else if (error) {
          this.popupService.showError(decodeURIComponent(error), 'Google Login Failed');
        }
      }
    });

    // 2. Listen for messages from popup (as the main window)
    // PostMessage fallback
    window.addEventListener('message', this.messageListener);

    // BroadcastChannel via AuthService (Recommended)
    const googleLoginSub = this.authService.googleLogin$.subscribe(result => {
      this.processGoogleLoginResult(result);
    });
    this.verifiedSub = new Subscription();
    this.verifiedSub.add(googleLoginSub);

    // Listen for verification success to auto-login
    const otpSub = this.otpService.onVerified$.subscribe(() => {
      this.isAutoLogin = true;
      this.onSubmit();
    });
    this.verifiedSub.add(otpSub);
  }

  ngOnDestroy() {
    if (this.verifiedSub) {
      this.verifiedSub.unsubscribe();
    }
    window.removeEventListener('message', this.messageListener);
  }

  private processGoogleLoginResult(result: {token?: string, error?: string}) {
    const { token, error } = result;
    if (token) {
      this.handleLoginSuccess(token);
    } else if (error) {
      this.popupService.showError(decodeURIComponent(error), 'Google Login Failed');
    }
  }

  private handleLoginSuccess(token: string) {
    localStorage.setItem('token', token);
    this.loadingService.show();
    this.authService.getProfile().subscribe({
      next: () => {
        // Wait 1 second before navigating to home as requested
        setTimeout(() => {
          this.loadingService.hide();
          this.router.navigate(['/home']);
        }, 1000);
      },
      error: (err) => {
        this.loadingService.hide();
        this.popupService.showError('Failed to fetch user profile', 'Authentication Error');
      }
    });
  }

  public onSubmit(): void {
    this.isSubmitted = true;
    if (this.loginForm.valid) {
      this.loadingService.show();
      
      this.authService.signin(this.loginForm.value).subscribe({
        next: (response) => {
          this.loadingService.hide();
          
          if (response.status === 200) {
            if (this.isAutoLogin) {
              this.isAutoLogin = false;
              this.popupService.showSuccess(
                'Verification successful! Welcome to EZMOVIE. Enjoy your movies!',
                'Success',
                undefined,
                () => {
                  // After "Got it" is clicked
                  this.loadingService.show();
                  setTimeout(() => {
                    this.loadingService.hide();
                    this.router.navigate(['/home']);
                  }, 1000);
                }
              );
            } else {
              this.router.navigate(['/home']);
            }
          } else if (response.status === 403) {
            // Case: Account not activated. Automatically resend OTP.
            const email = this.loginForm.get('email')?.value;
            this.authService.resendOtp(email).subscribe();
            this.otpService.show(email, 'signin');
          } else {
            // Other errors (404, 401, etc.)
            this.popupService.showError(response.message, 'Signin Failed');
          }
        },
        error: (err) => {
          this.loadingService.hide();
          this.popupService.showError('Could not connect to the server. Please try again later.', 'System Error');
        }
      });
    } else {
      this.loginForm.markAllAsTouched();
    }
  }

  public loginWithGoogle(): void {
    this.authService.openGoogleLoginPopup();
  }
}
