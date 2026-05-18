import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';

import { Router } from '@angular/router';
import { LoadingService } from '../../services/loading.service';
import { AuthService } from '../../services/auth.service';
import { PopupService } from '../../services/popup.service';
import { OtpService } from '../../services/otp.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css'],
})
export class SignupComponent implements OnInit, OnDestroy {
  public signupForm: FormGroup;
  public isSubmitted: boolean = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private loadingService: LoadingService,
    private authService: AuthService,
    private popupService: PopupService,
    private otpService: OtpService,
  ) {
    this.signupForm = this.fb.group(
      {
        username: ['', Validators.required],
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
        confirmPassword: ['', Validators.required],
      },
      { validators: this.passwordMatchValidator },
    );
  }

  private messageListener = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.data.type === 'google-login-result') {
      this.processGoogleLoginResult(event.data);
    }
  };

  private googleSub?: Subscription;

  ngOnInit() {
    // 1. Listen for messages from popup (PostMessage fallback)
    window.addEventListener('message', this.messageListener);

    // 2. BroadcastChannel via AuthService (Recommended)
    this.googleSub = this.authService.googleLogin$.subscribe(result => {
      this.processGoogleLoginResult(result);
    });
  }

  ngOnDestroy() {
    if (this.googleSub) {
      this.googleSub.unsubscribe();
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

  public getErrorMessage(controlName: string): string {
    const control = this.signupForm.get(controlName);
    if (control && (control.touched || control.dirty) && control.errors) {
      if (control.errors['required']) {
        const labels: { [key: string]: string } = {
          username: 'Username',
          email: 'Email address',
          password: 'Password',
          confirmPassword: 'Confirm password',
        };
        return `${labels[controlName] || 'This field'} is required`;
      }
      if (control.errors['email']) return 'Invalid email address';
      if (control.errors['minlength'])
        return `Minimum length is ${control.errors['minlength'].requiredLength}`;
      if (control.errors['pattern']) {
        if (controlName === 'password') {
          return 'Must contain at least 8 chars, 1 uppercase, 1 lowercase, 1 number, and 1 special char';
        }
        return 'Invalid format';
      }
    }

    if (
      controlName === 'username' &&
      control?.errors?.['required'] &&
      (control?.touched || control?.dirty)
    ) {
      return 'Username is required';
    }

    if (
      controlName === 'confirmPassword' &&
      this.signupForm.errors?.['mismatch'] &&
      (control?.touched || control?.dirty)
    ) {
      return 'Passwords do not match';
    }

    return '';
  }

  public isFieldValid(controlName: string): boolean | null {
    const control = this.signupForm.get(controlName);
    if (!control) return null;

    // Chỉ hiện icon nếu đã bấm Submit hoặc (đã gõ dữ liệu VÀ đã chạm vào)
    if (this.isSubmitted || (control.dirty && control.touched)) {
      // For confirmPassword, check mismatch error on the form as well
      if (
        controlName === 'confirmPassword' &&
        this.signupForm.errors?.['mismatch']
      ) {
        return false;
      }

      // Nếu hợp lệ: chỉ hiện tích xanh nếu có giá trị
      if (control.valid) {
        return control.value ? true : null;
      }

      return false;
    }

    return null;
  }

  public passwordMatchValidator(
    control: AbstractControl,
  ): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  public onSubmit(): void {
    this.isSubmitted = true;
    if (this.signupForm.valid) {
      this.loadingService.show();

      // Lấy dữ liệu form (loại bỏ confirmPassword trước khi gửi lên API)
      const { confirmPassword, ...signupData } = this.signupForm.value;

      this.authService.signup(signupData).subscribe({
        next: (response) => {
          this.loadingService.hide();

          if (response.status === 200) {
            // Tắt popup thành công cũ (nếu có) để không bị đè
            this.popupService.hide();

            // Hiển thị Popup nhập OTP
            const userEmail = this.signupForm.get('email')?.value;
            this.otpService.show(userEmail, 'signup');
          } else {
            this.popupService.showError(response.message, 'Signup Failed');
          }
        },
        error: (err) => {
          this.loadingService.hide();
          this.popupService.showError(
            'Could not connect to the server. Please try again later.',
            'System Error',
          );
        },
      });
    } else {
      this.signupForm.markAllAsTouched();
    }
  }

  public signupWithGoogle(): void {
    this.authService.openGoogleLoginPopup();
  }
}
