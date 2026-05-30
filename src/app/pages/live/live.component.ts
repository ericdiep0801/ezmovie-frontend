import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LiveService, LiveDto } from '../../services/live.service';
import { LoadingService } from '../../services/loading.service';

@Component({
  selector: 'app-live',
  templateUrl: './live.component.html',
  styleUrls: ['./live.component.css']
})
export class LiveComponent implements OnInit {
  pageants: LiveDto[] = [];
  activePageant: LiveDto | null = null;
  safeEmbedUrl: SafeResourceUrl | null = null;

  constructor(
    private liveService: LiveService,
    private sanitizer: DomSanitizer,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    this.loadLivePageants();
  }

  loadLivePageants(): void {
    this.loadingService.show();
    this.liveService.getLivePageants().subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          this.pageants = res.data;
          if (this.pageants.length > 0) {
            this.playPageant(this.pageants[0]);
          }
        }
        this.loadingService.hide();
      },
      error: (err) => {
        console.error('Failed to load live pageants', err);
        this.loadingService.hide();
      }
    });
  }

  playPageant(pageant: LiveDto): void {
    this.activePageant = pageant;
    const separator = pageant.embedUrl.includes('?') ? '&' : '?';
    this.safeEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(pageant.embedUrl + separator + 'autoplay=1&mute=0');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
