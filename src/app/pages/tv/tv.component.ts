import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { TvService } from '../../services/tv.service';
import { AuthService } from '../../services/auth.service';
import { LoadingService } from '../../services/loading.service';
import { PopupService } from '../../services/popup.service';
import { Router } from '@angular/router';

declare var Hls: any;

@Component({
  selector: 'app-tv',
  templateUrl: './tv.component.html',
  styleUrls: ['./tv.component.css']
})
export class TvComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;

  public channels: any[] = [];
  public filteredChannels: any[] = [];
  public categories: string[] = [];
  public activeCategory: string = 'All';
  public searchQuery: string = '';
  
  public currentChannel: any = null;
  public epgSchedule: any[] = [];
  public activeProgram: any = null;

  public isFavorited: boolean = false;
  public isLoggedIn: boolean = false;
  public isLoadingStream: boolean = false;
  public isPlayerError: boolean = false;
  public playerErrorMessage: string = '';

  private hlsInstance: any = null;
  private syncTimer: any = null;

  constructor(
    private tvService: TvService,
    private authService: AuthService,
    private loadingService: LoadingService,
    private popupService: PopupService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user) => {
      this.isLoggedIn = !!user;
      if (this.isLoggedIn) {
        this.loadHlsLibrary();
        this.loadCategories();
        this.loadChannels();
      } else {
        if (this.hlsInstance) {
          this.hlsInstance.destroy();
          this.hlsInstance = null;
        }
      }
    });

    // Auto-refresh EPG and active program calculations every 60 seconds
    this.syncTimer = setInterval(() => {
      if (this.currentChannel && this.isLoggedIn) {
        this.calculateActiveProgram();
      }
    }, 60000);
  }

  ngAfterViewInit(): void {
    // Initial media setup after DOM matches viewchild
    if (this.currentChannel) {
      this.playChannel(this.currentChannel);
    }
  }

  ngOnDestroy(): void {
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
    }
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
  }

  // Ensure hls.js is loaded from CDN dynamically for high-fidelity cross-browser support
  private loadHlsLibrary(): void {
    if (typeof Hls === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
      script.type = 'text/javascript';
      script.async = true;
      script.onload = () => {
        console.log('[TvComponent] hls.js loaded successfully from CDN.');
        if (this.currentChannel) {
          this.playChannel(this.currentChannel);
        }
      };
      document.head.appendChild(script);
    }
  }

  // Load distinct categories from backend
  loadCategories(): void {
    this.tvService.getCategories().subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          this.categories = res.data;
        }
      },
      error: (err) => {
        console.error('Failed to load TV categories', err);
        this.categories = ['All', 'VTV', 'HTV', 'SCTV', 'Movies', 'Sports', 'Kids', 'Local'];
      }
    });
  }

  // Load TV channels
  loadChannels(selectSlug?: string): void {
    this.loadingService.show();
    this.tvService.getChannels(
      this.activeCategory === 'All' ? undefined : this.activeCategory,
      this.searchQuery.trim() ? this.searchQuery : undefined
    ).subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          this.channels = res.data;
          this.filterChannelsList();

          // Auto-select first channel or matching slug
          if (this.channels.length > 0) {
            let initialChannel = this.channels[0];
            if (selectSlug) {
              const matched = this.channels.find(c => c.slug === selectSlug);
              if (matched) initialChannel = matched;
            }
            this.selectChannel(initialChannel);
          }
        }
        this.loadingService.hide();
      },
      error: (err) => {
        console.error('Failed to load TV channels', err);
        this.loadingService.hide();
        this.popupService.showError('Không thể kết nối đến máy chủ TV', 'Lỗi Kết Nối');
      }
    });
  }

  // Filter channels based on Search box and active category
  filterChannelsList(): void {
    let list = this.channels;
    if (this.activeCategory && this.activeCategory !== 'All') {
      list = list.filter(c => c.category?.toLowerCase() === this.activeCategory.toLowerCase());
    }
    if (this.searchQuery && this.searchQuery.trim()) {
      const keyword = this.searchQuery.toLowerCase().trim();
      list = list.filter(c => c.name?.toLowerCase().includes(keyword));
    }
    this.filteredChannels = list;
  }

  selectCategory(cat: string): void {
    this.activeCategory = cat;
    this.loadChannels();
  }

  onSearchChange(): void {
    this.filterChannelsList();
  }

  // Select a channel, load its detail, mock EPG, and trigger HLS player
  selectChannel(channel: any): void {
    if (!channel) return;
    
    this.isPlayerError = false;
    this.isLoadingStream = true;
    
    this.tvService.getChannelBySlug(channel.slug).subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          this.currentChannel = res.data;
          this.isFavorited = !!res.data.isFavorited;
          this.epgSchedule = res.data.epg || [];
          this.calculateActiveProgram();
          this.playChannel(this.currentChannel);

          // Log watch history to database if authenticated
          if (this.isLoggedIn) {
            this.tvService.addWatchHistory(this.currentChannel.id).subscribe();
          }
        } else {
          this.isLoadingStream = false;
          this.isPlayerError = true;
          this.playerErrorMessage = 'Kênh hiện tại không phát tuyến hoặc đã bị khóa.';
        }
      },
      error: (err) => {
        console.error('Failed to load channel details', err);
        this.isLoadingStream = false;
        this.isPlayerError = true;
        this.playerErrorMessage = 'Kênh đang gặp sự cố kết nối. Vui lòng chọn kênh khác.';
      }
    });
  }

  // Set up and play the HLS stream URL with automatic Fallbacks
  private playChannel(channel: any): void {
    if (!channel || !channel.streamUrl) return;

    this.isLoadingStream = true;
    this.isPlayerError = false;

    // Destoy previous HLS instances safely to prevent memory leaks
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }

    setTimeout(() => {
      const video = this.videoPlayer?.nativeElement;
      if (!video) {
        this.isLoadingStream = false;
        return;
      }

      const streamUrl = channel.streamUrl;

      // Handle standard HLS play
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60
        });

        this.hlsInstance = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(e => {
            console.log('[TvComponent] Autoplay prevented, waiting for user click.', e);
          });
          this.isLoadingStream = false;
        });

        hls.on(Hls.Events.ERROR, (event: any, data: any) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn('[TvComponent] Network error, attempting to recover...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn('[TvComponent] Media error, attempting to recover...');
                hls.recoverMediaError();
                break;
              default:
                this.isPlayerError = true;
                this.isLoadingStream = false;
                this.playerErrorMessage = 'Luồng phát hiện tại bị gián đoạn. Thử chọn kênh khác!';
                hls.destroy();
                this.hlsInstance = null;
                break;
            }
          }
        });
      }
      // Native iOS HLS support (Safari)
      else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(e => console.log('[TvComponent] Autoplay prevented.', e));
          this.isLoadingStream = false;
        });
        video.addEventListener('error', () => {
          this.isPlayerError = true;
          this.isLoadingStream = false;
          this.playerErrorMessage = 'Định dạng luồng phát không tương thích với trình duyệt.';
        });
      } else {
        this.isLoadingStream = false;
        this.isPlayerError = true;
        this.playerErrorMessage = 'Trình duyệt của bạn không hỗ trợ phát luồng HLS trực tiếp. Hãy cài Hls.js hoặc dùng trình duyệt Chrome/Edge/Safari!';
      }
    }, 100);
  }

  // Calculate active program inside EPG based on client hours
  calculateActiveProgram(): void {
    if (!this.epgSchedule || this.epgSchedule.length === 0) {
      this.activeProgram = null;
      return;
    }
    
    // Find program flagged as active
    const active = this.epgSchedule.find(p => p.isActive);
    this.activeProgram = active || this.epgSchedule[0];
  }

  // Toggle Favorite Status
  toggleFavorite(): void {
    if (!this.isLoggedIn) {
      this.popupService.showError('Bạn cần đăng nhập để thêm kênh yêu thích!', 'Yêu cầu Đăng Nhập');
      return;
    }

    if (!this.currentChannel) return;

    this.tvService.toggleFavorite(this.currentChannel.id).subscribe({
      next: (res) => {
        if (res.status === 200) {
          this.isFavorited = res.isFavorited;
          this.popupService.showSuccess(res.message, 'Đã cập nhật');
        }
      },
      error: () => {
        this.popupService.showError('Không thể cập nhật danh sách yêu thích lúc này.', 'Lỗi');
      }
    });
  }

  // Custom Player Handlers
  onPlayClick(): void {
    const video = this.videoPlayer?.nativeElement;
    if (video) {
      if (video.paused) {
        video.play().catch(e => console.log(e));
      } else {
        video.pause();
      }
    }
  }

  toggleFullscreen(): void {
    const video = this.videoPlayer?.nativeElement;
    if (video) {
      if (video.requestFullscreen) {
        video.requestFullscreen();
      } else if ((video as any).webkitRequestFullscreen) { /* Safari */
        (video as any).webkitRequestFullscreen();
      } else if ((video as any).msRequestFullscreen) { /* IE11 */
        (video as any).msRequestFullscreen();
      }
    }
  }

  onVideoPlaying(): void {
    this.isLoadingStream = false;
  }

  handleLogoError(event: any): void {
    event.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%2313131a" stroke="%2322222e" stroke-width="2"/><rect x="25" y="38" width="50" height="38" rx="6" stroke="%23ff4b5c" stroke-width="4"/><path d="M40 22 L50 38 L60 22" stroke="%23ff4b5c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="50" cy="57" r="6" fill="%23ff4b5c"/><line x1="30" y1="84" x2="70" y2="84" stroke="%2322222e" stroke-width="4" stroke-linecap="round"/></svg>';
  }

  onVideoWaiting(): void {
    this.isLoadingStream = true;
  }

  // IPTV Playlist Importer properties & methods
  showImportModal = false;
  m3uPlaylistUrl = '';
  cleanOnImport = false;
  isImporting = false;

  openImportModal(): void {
    this.showImportModal = true;
    this.m3uPlaylistUrl = '';
    this.cleanOnImport = false;
  }

  closeImportModal(): void {
    if (!this.isImporting) {
      this.showImportModal = false;
    }
  }

  setSuggestedM3u(url: string): void {
    this.m3uPlaylistUrl = url;
  }

  submitM3uImport(): void {
    if (!this.m3uPlaylistUrl || !this.m3uPlaylistUrl.trim().startsWith('http')) {
      alert('Vui lòng nhập đường dẫn M3U playlist hợp lệ (bắt đầu bằng http hoặc https)!');
      return;
    }

    this.isImporting = true;
    this.tvService.syncFromM3u(this.m3uPlaylistUrl.trim(), this.cleanOnImport).subscribe({
      next: (res: any) => {
        this.isImporting = false;
        if (res.status === 200) {
          alert(`Đồng bộ thành công! Đã nhập ${res.data?.successfullyImported || 0} kênh TV chất lượng cao vào hệ thống.`);
          this.showImportModal = false;
          // Refresh lists to display newly imported channels
          this.loadCategories();
          this.loadChannels();
        } else {
          alert(`Nhập playlist thất bại: ${res.message}`);
        }
      },
      error: (err: any) => {
        this.isImporting = false;
        alert(`Không thể kết nối máy chủ để đồng bộ: ${err.error?.message || err.message || err}`);
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
