import { Component, OnDestroy, OnInit } from '@angular/core';
import { OtpService } from '../../services/otp.service';
import { AuthService } from '../../services/auth.service';
import { LoadingService } from '../../services/loading.service';
import { PopupService } from '../../services/popup.service';
import { Router } from '@angular/router';
import { interval, Subscription, take } from 'rxjs';

@Component({
  selector: 'app-verify-otp',
  templateUrl: './verify-otp.component.html',
  styleUrls: ['./verify-otp.component.css'],
})
export class VerifyOtpComponent implements OnInit, OnDestroy {
  public otpCode: string = '';
  public email: string = '';
  public timeLeft: number = 60; // 1 minute (60 seconds)
  public formattedTime: string = '01:00';
  public isLoading: boolean = false;
  private timerSub?: Subscription;

  constructor(
    public otpService: OtpService,
    private authService: AuthService,
    private loadingService: LoadingService,
    private popupService: PopupService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.otpService.otpState$.subscribe((state) => {
      if (state.show) {
        this.email = state.email;
        this.otpCode = ''; // Reset mã OTP cũ mỗi khi mở popup
        this.startTimer();
      } else {
        this.stopTimer();
      }
    });
  }

  startTimer() {
    this.stopTimer();
    this.timeLeft = 60;
    this.updateFormattedTime();
    this.timerSub = interval(1000).subscribe(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--;
        this.updateFormattedTime();
      } else {
        this.stopTimer();
      }
    });
  }

  stopTimer() {
    if (this.timerSub) {
      this.timerSub.unsubscribe();
    }
  }

  updateFormattedTime() {
    const mins = Math.floor(this.timeLeft / 60);
    const secs = this.timeLeft % 60;
    this.formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  onSubmit() {
    if (this.isLoading) return;
    
    if (this.otpCode.length !== 6) {
      this.popupService.showError(
        'Please enter a 6-digit OTP code.',
        'Invalid Code',
      );
      return;
    }

    this.isLoading = true;
    this.loadingService.show();
    this.authService
      .verifyOtp({ email: this.email, otpCode: this.otpCode })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          this.loadingService.hide();
          if (res.status === 200) {
            // Lấy source hiện tại từ state
            this.otpService.otpState$.pipe(take(1)).subscribe(state => {
              if (state.source === 'signin') {
                // Nếu từ trang Signin, thông báo thành công và để SigninComponent tự động Login
                this.otpService.hide();
                this.otpService.notifyVerified();
                this.popupService.showSuccess('Verification successful! Logging you in...', 'Success');
              } else {
                // Nếu từ trang Signup, quay về trang Login
                this.otpService.hide();
                this.popupService.showSuccess(
                  'Account activated successfully! You can now log in.',
                  'Signup Success',
                  '/login',
                );
              }
            });
          } else {
            this.popupService.showError(res.message, 'Verification Failed');
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.loadingService.hide();
          const errorMessage =
            err.error?.message || 'Verification failed. Please try again.';
          this.popupService.showError(errorMessage, 'Verification Failed');
        },
      });
  }

  onResendOtp() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.loadingService.show();
    this.authService.resendOtp(this.email).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.loadingService.hide();
        if (res.status === 200) {
          this.popupService.showSuccess(
            'A new OTP code has been sent to your email.',
            'OTP Resent',
          );
          this.startTimer(); // Khởi động lại bộ đếm ngược 1 phút
        } else {
          this.popupService.showError(res.message, 'Resend Failed');
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.loadingService.hide();
        const errorMessage =
          err.error?.message || 'Could not resend OTP. Please try again.';
        this.popupService.showError(errorMessage, 'Resend Failed');
      },
    });
  }

  close() {
    this.otpService.hide();
    this.popupService.showError(
      `Verification failed for account: ${this.email}. Please verify to continue.`,
      'Verification Incomplete',
    );
  }

  ngOnDestroy() {
    this.stopTimer();
  }
}
