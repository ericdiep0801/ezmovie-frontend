import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface OtpState {
  show: boolean;
  email: string;
  source: 'signup' | 'signin';
}

@Injectable({
  providedIn: 'root'
})
export class OtpService {
  private otpState = new BehaviorSubject<OtpState>({
    show: false,
    email: '',
    source: 'signup'
  });

  public otpState$ = this.otpState.asObservable();
  
  // Notifier for components when verification is successful
  private verifiedSubject = new Subject<void>();
  public onVerified$ = this.verifiedSubject.asObservable();

  show(email: string, source: 'signup' | 'signin' = 'signup') {
    this.otpState.next({ show: true, email, source });
  }

  hide() {
    this.otpState.next({ ...this.otpState.value, show: false });
  }

  notifyVerified() {
    this.verifiedSubject.next();
  }
}
