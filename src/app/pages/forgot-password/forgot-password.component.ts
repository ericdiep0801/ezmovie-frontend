import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoadingService } from '../../services/loading.service';
import { PopupService } from '../../services/popup.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {
  public forgotForm: FormGroup;
  public step: 1 | 2 = 1;
  public isSubmitted: boolean = false;
  public email: string = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private loadingService: LoadingService,
    private popupService: PopupService
  ) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      otpCode: ['', [Validators.minLength(6), Validators.maxLength(6)]],
      newPassword: [
        '',
        [
          Validators.minLength(8),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/)
        ]
      ],
      confirmPassword: ['']
    }, { validator: this.passwordMatchValidator });
  }

  private passwordMatchValidator(g: FormGroup) {
    const password = g.get('newPassword')?.value;
    const confirmPassword = g.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  public getErrorMessage(controlName: string): string {
    const control = this.forgotForm.get(controlName);
    if (control && (control.touched || control.dirty) && control.errors) {
      if (control.errors['required']) return 'This field is required';
      if (control.errors['email']) return 'Invalid email address';
      if (control.errors['minlength']) return 'Too short';
      if (control.errors['pattern']) return 'Password too weak';
    }
    if (controlName === 'confirmPassword' && this.forgotForm.errors?.['mismatch'] && this.forgotForm.get('confirmPassword')?.touched) {
      return 'Passwords do not match';
    }
    return '';
  }

  public isFieldValid(controlName: string): boolean | null {
    const control = this.forgotForm.get(controlName);
    if (!control || !(control.touched || control.dirty)) return null;
    
    if (controlName === 'confirmPassword' && this.forgotForm.errors?.['mismatch']) {
      return false;
    }
    
    return control.valid;
  }

  public onSubmit(): void {
    this.isSubmitted = true;
    
    if (this.step === 1) {
      const emailControl = this.forgotForm.get('email');
      if (emailControl?.valid) {
        this.email = emailControl.value;
        this.loadingService.show();
        this.authService.forgotPassword(this.email).subscribe({
          next: (res) => {
            this.loadingService.hide();
            if (res.status === 200) {
              this.step = 2;
              this.isSubmitted = false;
              // Add required validators to step 2 fields
              this.forgotForm.get('otpCode')?.setValidators([Validators.required, Validators.minLength(6)]);
              this.forgotForm.get('newPassword')?.setValidators([
                Validators.required, 
                Validators.minLength(8),
                Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/)
              ]);
              this.forgotForm.get('confirmPassword')?.setValidators([Validators.required]);
              this.forgotForm.get('otpCode')?.updateValueAndValidity();
              this.forgotForm.get('newPassword')?.updateValueAndValidity();
              this.forgotForm.get('confirmPassword')?.updateValueAndValidity();
              this.popupService.showInfo('Please check your email for the OTP code.', 'OTP Sent');
            } else {
              this.popupService.showError(res.message, 'Failed');
            }
          },
          error: (err) => {
            this.loadingService.hide();
            this.popupService.showError('System error. Please try again.', 'Error');
          }
        });
      }
    } else {
      if (this.forgotForm.valid) {
        this.loadingService.show();
        const resetData = {
          email: this.email,
          otpCode: this.forgotForm.get('otpCode')?.value,
          newPassword: this.forgotForm.get('newPassword')?.value
        };
        
        this.authService.resetPassword(resetData).subscribe({
          next: (res) => {
            this.loadingService.hide();
            if (res.status === 200) {
              this.popupService.showSuccess('Password has been reset successfully!', 'Success', '/login');
            } else {
              this.popupService.showError(res.message, 'Reset Failed');
            }
          },
          error: (err) => {
            this.loadingService.hide();
            this.popupService.showError('System error. Please try again.', 'Error');
          }
        });
      } else {
        this.forgotForm.markAllAsTouched();
      }
    }
  }
}
