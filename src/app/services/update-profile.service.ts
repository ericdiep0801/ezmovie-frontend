import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UpdateProfileService {
  private showSubject = new BehaviorSubject<boolean>(false);
  public show$ = this.showSubject.asObservable();

  show() {
    this.showSubject.next(true);
  }

  hide() {
    this.showSubject.next(false);
  }
}
