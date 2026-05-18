import { Component, Input, forwardRef, OnInit, OnDestroy } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-input',
  templateUrl: './input.component.html',
  styleUrls: ['./input.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
})
export class InputComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() public type: string = 'text';
  @Input() public placeholder: string = '';
  @Input() public label: string = '';
  @Input() public id: string = '';
  @Input() public errorMsg: string = '';
  @Input() public debounce: number = 0;
  @Input() public mask: 'none' | 'phone' | 'currency' = 'none';
  @Input() public isValid: boolean | null = null; // true for success UI, false for error UI
  @Input() public hasPrefix: boolean = false;
  @Input() public hasSuffix: boolean = false;
  @Input() public autocomplete: string = 'off';

  public value: string = '';
  public isDisabled: boolean = false;
  public showPassword: boolean = false;
  public isFocused: boolean = false;

  private valueChange$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  public onChange: any = () => {};
  public onTouch: any = () => {};

  public ngOnInit(): void {
    this.valueChange$
      .pipe(
        debounceTime(this.debounce),
        takeUntil(this.destroy$)
      )
      .subscribe((val) => {
        this.onChange(val);
      });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public get inputType(): string {
    if (this.type === 'password') {
      return this.showPassword ? 'text' : 'password';
    }
    return this.type;
  }

  public togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  public writeValue(value: any): void {
    this.value = this.applyMask(value || '');
  }

  public registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: any): void {
    this.onTouch = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  public onInputChange(event: any): void {
    const rawValue = event.target.value;
    this.value = this.applyMask(rawValue);
    event.target.value = this.value; // enforce mask on input field
    
    // Emit unmasked value or masked value depending on mask type
    const emitValue = this.mask === 'currency' ? this.value.replace(/\D/g, '') : this.value;
    
    if (this.debounce > 0) {
      this.valueChange$.next(emitValue);
    } else {
      this.onChange(emitValue);
    }
  }

  public onFocus(): void {
    this.isFocused = true;
  }

  public onBlur(): void {
    this.isFocused = false;
    this.onTouch();
  }

  private applyMask(val: string): string {
    if (!val) return '';
    val = val.toString();
    
    if (this.mask === 'currency') {
      const numbers = val.replace(/\D/g, '');
      if (!numbers) return '';
      return new Intl.NumberFormat('vi-VN').format(Number(numbers));
    }
    
    if (this.mask === 'phone') {
      const numbers = val.replace(/\D/g, '').substring(0, 10);
      if (numbers.length <= 4) return numbers;
      if (numbers.length <= 7) return `${numbers.substring(0, 4)} ${numbers.substring(4)}`;
      return `${numbers.substring(0, 4)} ${numbers.substring(4, 7)} ${numbers.substring(7)}`;
    }
    
    return val;
  }
}
