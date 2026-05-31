import { Injectable, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { TranslationService } from './translation.service';

export type Theme = 'dark' | 'light';
export type Language = 'vi' | 'en';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private themeSubject = new BehaviorSubject<Theme>('dark');
  public theme$ = this.themeSubject.asObservable();

  private langSubject = new BehaviorSubject<Language>('vi');
  public lang$ = this.langSubject.asObservable();

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private translationService: TranslationService
  ) {
    this.init();
  }

  private init() {
    // Load theme
    const savedTheme = localStorage.getItem('ezmovie_theme') as Theme;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      this.setTheme(savedTheme);
    } else {
      this.setTheme('dark'); // Default
    }

    // Load language
    const savedLang = localStorage.getItem('ezmovie_lang') as Language;
    if (savedLang === 'vi' || savedLang === 'en') {
      this.setLanguage(savedLang);
    } else {
      this.setLanguage('vi'); // Default
    }
  }

  setTheme(theme: Theme) {
    this.themeSubject.next(theme);
    localStorage.setItem('ezmovie_theme', theme);
    if (theme === 'light') {
      this.document.body.classList.add('light-theme');
    } else {
      this.document.body.classList.remove('light-theme');
    }
  }

  get currentTheme(): Theme {
    return this.themeSubject.value;
  }

  setLanguage(lang: Language) {
    this.langSubject.next(lang);
    localStorage.setItem('ezmovie_lang', lang);
    this.translationService.setCurrentLanguage(lang);
  }

  get currentLanguage(): Language {
    return this.langSubject.value;
  }
}
