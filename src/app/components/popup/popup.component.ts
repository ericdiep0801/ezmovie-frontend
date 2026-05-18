import { Component } from '@angular/core';
import { PopupService } from '../../services/popup.service';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-popup',
  templateUrl: './popup.component.html',
  styleUrls: ['./popup.component.css']
})
export class PopupComponent {
  constructor(
    public popupService: PopupService,
    private router: Router
  ) {}

  close() {
    this.popupService.popup$.pipe(take(1)).subscribe(state => {
      this.popupService.hide();
      if (state.onClose) {
        state.onClose();
      }
      if (state.redirectUrl) {
        this.router.navigate([state.redirectUrl]);
      }
    });
  }

  confirm() {
    this.popupService.popup$.pipe(take(1)).subscribe(state => {
      if (state.onConfirm) {
        state.onConfirm();
      }
      this.popupService.hide();
    });
  }
}
