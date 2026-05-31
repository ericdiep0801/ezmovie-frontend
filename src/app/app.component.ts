import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'frontend';

  constructor(
    public router: Router,
    private settingsService: SettingsService
  ) {}

  isAdminRoute(): boolean {
    return this.router.url.startsWith('/admin');
  }
}
