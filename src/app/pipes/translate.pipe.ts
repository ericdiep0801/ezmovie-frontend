import { Pipe, PipeTransform, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { TranslationService } from '../services/translation.service';
import { Subscription } from 'rxjs';

@Pipe({
  name: 'translate',
  pure: false // Allows the pipe to re-evaluate when language changes
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private currentKey: string = '';
  private currentTranslation: string = '';
  private sub: Subscription | null = null;

  constructor(
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {}

  transform(key: string | undefined | null): string {
    if (!key || key.length === 0) {
      return key || '';
    }

    if (this.currentKey === key) {
      return this.currentTranslation;
    }

    this.currentKey = key;
    this.updateTranslation();

    if (!this.sub) {
      this.sub = this.translationService.currentLang$.subscribe(() => {
        this.updateTranslation();
        this.cdr.markForCheck();
      });
    }

    return this.currentTranslation;
  }

  private updateTranslation() {
    this.currentTranslation = this.translationService.translate(this.currentKey);
  }

  ngOnDestroy() {
    if (this.sub) {
      this.sub.unsubscribe();
    }
  }
}
