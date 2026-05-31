import { Component, OnInit } from '@angular/core';
import { SettingsService, Theme, Language } from '../../services/settings.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-settings-modal',
  templateUrl: './settings-modal.component.html',
  styleUrls: ['./settings-modal.component.css']
})
export class SettingsModalComponent implements OnInit {
  isVisible = false;
  currentTheme: Theme = 'dark';
  currentLang: Language = 'vi';
  
  private destroy$ = new Subject<void>();

  constructor(public settingsService: SettingsService) {}

  ngOnInit(): void {
    this.settingsService.theme$
      .pipe(takeUntil(this.destroy$))
      .subscribe(theme => this.currentTheme = theme);
      
    this.settingsService.lang$
      .pipe(takeUntil(this.destroy$))
      .subscribe(lang => this.currentLang = lang);
  }

  show() {
    this.isVisible = true;
    document.body.style.overflow = 'hidden';
  }

  hide() {
    this.isVisible = false;
    document.body.style.overflow = '';
  }

  setTheme(theme: Theme) {
    this.settingsService.setTheme(theme);
  }

  setLanguage(lang: Language) {
    this.settingsService.setLanguage(lang);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
