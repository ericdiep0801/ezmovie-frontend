import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoadingService } from '../../services/loading.service';
import { PopupService } from '../../services/popup.service';

import { ChangePasswordService } from '../../services/change-password.service';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css']
})
export class ChangePasswordComponent {
  public changePasswordForm: FormGroup;
  public isSubmitted: boolean = false;
  public isOpen: boolean = false;

  constructor(
    private fb: FormBuilder, 
    private router: Router,
    private authService: AuthService,
    private loadingService: LoadingService,
    private popupService: PopupService,
    private changePasswordService: ChangePasswordService
  ) {
    this.changePasswordService.show$.subscribe(val => {
      this.isOpen = val;
      if (val) {
        this.changePasswordForm.reset();
        this.isSubmitted = false;
      }
    });
    this.changePasswordForm = this.fb.group(
      {
        oldPassword: ['', Validators.required],
        newPassword: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/),
          ],
        ],
        confirmNewPassword: ['', Validators.required],
      },
      { validators: this.passwordMatchValidator }
    );
  }

  public getErrorMessage(controlName: string): string {
    const control = this.changePasswordForm.get(controlName);
    if (control && (control.touched || control.dirty) && control.errors) {
      if (control.errors['required']) {
        const labels: { [key: string]: string } = {
          oldPassword: 'Current password',
          newPassword: 'New password',
          confirmNewPassword: 'Confirm new password'
        };
        return `${labels[controlName] || 'This field'} is required`;
      }
      if (control.errors['minlength']) return `Minimum length is ${control.errors['minlength'].requiredLength}`;
      if (control.errors['pattern']) {
        if (controlName === 'newPassword') {
          return 'Must contain at least 8 chars, 1 uppercase, 1 lowercase, 1 number, and 1 special char';
        }
        return 'Invalid format';
      }
    }
    
    if (controlName === 'confirmNewPassword' && this.changePasswordForm.errors?.['mismatch'] && (control?.touched || control?.dirty)) {
      return 'Passwords do not match';
    }
    
    return '';
  }

  public isFieldValid(controlName: string): boolean | null {
    const control = this.changePasswordForm.get(controlName);
    if (!control || !(control.touched || control.dirty)) return null;
    
    if (controlName === 'confirmNewPassword' && this.changePasswordForm.errors?.['mismatch']) {
      return false;
    }
    
    return control.valid;
  }

  public passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmNewPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  public close(): void {
    this.changePasswordService.hide();
  }

  public onSubmit(): void {
    this.isSubmitted = true;
    if (this.changePasswordForm.valid) {
      this.loadingService.show();
      const { oldPassword, newPassword } = this.changePasswordForm.value;
      
      this.authService.changePassword({ oldPassword, newPassword }).subscribe({
        next: (res) => {
          this.loadingService.hide();
          if (res.status === 200) {
            this.close();
            this.popupService.showSuccess(
              'Password changed successfully! Please log in again with your new password.',
              'Success',
              undefined,
              () => {
                // Auto logout flow
                this.loadingService.show();
                setTimeout(() => {
                  this.authService.logout();
                  this.loadingService.hide();
                  this.router.navigate(['/login']);
                }, 1000);
              }
            );
          } else {
            this.popupService.showError(res.message, 'Change Failed');
          }
        },
        error: (err) => {
          this.loadingService.hide();
          const msg = err.error?.message || 'System error. Please try again.';
          this.popupService.showError(msg, 'Error');
        }
      });
    } else {
      this.changePasswordForm.markAllAsTouched();
    }
  }
}
