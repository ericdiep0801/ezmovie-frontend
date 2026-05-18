import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface PopupData {
  type: 'success' | 'error' | 'info' | 'warning' | 'confirm';
  title: string;
  message: string;
  show: boolean;
  redirectUrl?: string;
  onConfirm?: () => void;
  onClose?: () => void;
  confirmText?: string;
  cancelText?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PopupService {
  private popupSubject = new BehaviorSubject<PopupData>({
    type: 'info',
    title: '',
    message: '',
    show: false
  });

  public popup$ = this.popupSubject.asObservable();

  showError(message: string, title: string = 'Error') {
    this.popupSubject.next({ type: 'error', title, message, show: true });
  }

  showSuccess(message: string, title: string = 'Success', redirectUrl?: string, onClose?: () => void) {
    this.popupSubject.next({ type: 'success', title, message, show: true, redirectUrl, onClose });
  }

  showInfo(message: string, title: string = 'Information') {
    this.popupSubject.next({ type: 'info', title, message, show: true });
  }

  showConfirm(
    message: string,
    title: string = 'Confirm Action',
    onConfirm: () => void,
    confirmText: string = 'Đồng ý',
    cancelText: string = 'Hủy'
  ) {
    this.popupSubject.next({
      type: 'confirm',
      title,
      message,
      show: true,
      onConfirm,
      confirmText,
      cancelText
    });
  }

  hide() {
    this.popupSubject.next({ ...this.popupSubject.value, show: false });
  }
}
