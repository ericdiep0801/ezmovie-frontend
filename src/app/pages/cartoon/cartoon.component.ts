import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CartoonService, CartoonSeries, CartoonEpisode } from '../../services/cartoon.service';
import { LoadingService } from '../../services/loading.service';
import { PopupService } from '../../services/popup.service';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';

declare const Hls: any;

@Component({
  selector: 'app-cartoon',
  templateUrl: './cartoon.component.html',
  styleUrls: ['./cartoon.component.css']
})
export class CartoonComponent implements OnInit, OnDestroy {
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;
  @ViewChild('progressBar') progressBar!: ElementRef<HTMLDivElement>;
  @ViewChild('ambientCanvas') ambientCanvas!: ElementRef<HTMLCanvasElement>;

  public seriesList: CartoonSeries[] = [];
  public selectedSeries: CartoonSeries | null = null;
  public episodes: CartoonEpisode[] = [];
  public selectedEpisode: CartoonEpisode | null = null;
  
  public searchQuery: string = '';
  public activeTab: string = 'Thiếu Nhi';
  public cinemaMode: boolean = false;
  
  public safePlayerUrl: SafeResourceUrl | null = null;

  // Custom player properties cloned from movie-detail
  public isHlsMode: boolean = true;
  public isPlaying: boolean = false;
  public currentTime: number = 0;
  public duration: number = 0;
  public isScrubbing: boolean = false;
  public volume: number = 1.0;
  public isMuted: boolean = false;
  public isFullscreen: boolean = false;
  public showControls: boolean = true;
  public bufferedPercent: number = 0;
  public progressPercent: number = 0;
  public skipIndicatorText: string = '';
  public showSkipFlash: boolean = false;
  public showLeftRipple: boolean = false;
  public showRightRipple: boolean = false;
  public availableResolutions: any[] = [];
  public currentResolutionIndex: number = -1;
  public showResolutionMenu: boolean = false;
  public activeResolutionLabel: string = 'Auto';
  public showSettingsMenu: boolean = false;
  public activeSettingsSubMenu: 'main' | 'speed' | 'aspect' = 'main';
  public currentSpeed: number = 1.0;
  public availableSpeeds: number[] = [0.5, 1.0, 1.25, 1.5, 2.0];
  public currentAspectRatio: string = 'Default';
  public availableAspectRatios: string[] = ['Default', '16:9', '4:3', 'Fill'];
  public skipAccumulator: number = 0;
  public brightness: number = 1.0;
  public showHoverTime: boolean = false;
  public hoverX: number = 0;
  public hoverTimeText: string = '00:00';

  private hls: any = null;
  private controlsTimeout: any = null;
  private skipFlashTimeout: any = null;
  private leftRippleTimeout: any = null;
  private rightRippleTimeout: any = null;
  private skipClickTimeout: any = null;
  private ambientInterval: any = null;
  
  // Expose Math to template
  public Math = Math;

  constructor(
    private readonly cartoonService: CartoonService,
    private readonly loadingService: LoadingService,
    private readonly popupService: PopupService,
    private readonly sanitizer: DomSanitizer,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSeries();
  }

  ngOnDestroy(): void {
    document.body.classList.remove('cartoon-cinema-mode');
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout);
    }
    this.stopAmbientGlow();
  }

  loadSeries(): void {
    this.loadingService.show();
    this.cartoonService.getSeriesList().subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          this.seriesList = res.data;
          if (this.seriesList.length > 0) {
            this.selectSeries(this.seriesList[0]);
          }
        }
        this.loadingService.hide();
      },
      error: (err) => {
        console.error('Failed to load cartoon series list', err);
        this.popupService.showError('Không thể kết nối máy chủ hoạt hình.', 'Lỗi hệ thống');
        this.loadingService.hide();
      }
    });
  }

  selectSeries(series: CartoonSeries): void {
    this.selectedSeries = series;
    this.searchQuery = ''; // Reset search query when changing series
    this.loadEpisodes(series.id);
  }

  loadEpisodes(seriesId: string, keyword?: string): void {
    this.loadingService.show();
    this.cartoonService.getEpisodes(seriesId, keyword).subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          this.episodes = res.data;
          if (this.episodes.length > 0) {
            this.selectEpisode(this.episodes[0]);
          } else {
            this.selectedEpisode = null;
            this.safePlayerUrl = null;
          }
        }
        this.loadingService.hide();
      },
      error: (err) => {
        console.error('Failed to load episodes for cartoon series', err);
        this.popupService.showError('Không thể tải danh sách tập phim.', 'Lỗi');
        this.loadingService.hide();
      }
    });
  }

  selectEpisode(episode: CartoonEpisode): void {
    this.selectedEpisode = episode;
    
    if (!episode.linkM3u8 && episode.slug) {
      this.loadingService.show();
      this.cartoonService.getEpisodeEmbed(episode.slug).subscribe({
        next: (res) => {
          if (res && (res.linkM3u8 || res.linkEmbed)) {
            episode.linkEmbed = res.linkEmbed || episode.linkEmbed;
            episode.linkM3u8 = res.linkM3u8 || '';
          }
          this.playEpisodeEmbed(episode);
          this.loadingService.hide();
        },
        error: (err) => {
          console.error('Failed to resolve on-demand cartoon link', err);
          this.playEpisodeEmbed(episode);
          this.loadingService.hide();
        }
      });
    } else {
      this.playEpisodeEmbed(episode);
    }
  }

  playEpisodeEmbed(episode: CartoonEpisode): void {
    let embedUrl = episode.linkEmbed || '';
    if (embedUrl.startsWith('//')) {
      embedUrl = 'https:' + embedUrl;
    }
    
    this.safePlayerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.progressPercent = 0;
    this.bufferedPercent = 0;

    if (this.isHlsMode && episode.linkM3u8) {
      this.initializeHlsPlayer();
    }
    
    this.cdr.detectChanges();
  }

  // Custom HLS VIP Player methods
  initializeHlsPlayer(): void {
    if (!this.selectedEpisode || !this.selectedEpisode.linkM3u8) {
      console.warn('No m3u8 streaming link found for this episode.');
      return;
    }

    const streamUrl = this.selectedEpisode.linkM3u8;
    let retryCount = 0;
    const tryInit = () => {
      const video = this.videoPlayer?.nativeElement;
      if (!video) {
        if (retryCount < 10) {
          retryCount++;
          setTimeout(tryInit, 100);
        }
        return;
      }

      // Cleanup existing HLS instances
      if (this.hls) {
        this.hls.destroy();
        this.hls = null;
      }

      console.log('Initializing Cartoon HLS with stream:', streamUrl);

      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = new Hls({
          maxMaxBufferLength: 30,
          enableWorker: true,
          lowLatencyMode: true,
        });
        this.hls = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          this.availableResolutions = [];
          if (hls.levels && hls.levels.length > 0) {
            this.availableResolutions = hls.levels.map(
              (level: any, index: number) => {
                const height = level.height || 0;
                let label = height ? `${height}p` : `Level ${index + 1}`;
                if (level.bitrate) {
                  const mbps = (level.bitrate / 1000000).toFixed(1);
                  label += ` (${mbps} Mbps)`;
                }
                return {
                  index: index,
                  height: height,
                  label: label,
                };
              }
            );
            this.availableResolutions.sort((a: any, b: any) => b.height - a.height);
          }
          this.availableResolutions.push({
            index: -1,
            height: 0,
            label: 'Tự động (Auto)',
          });
          this.currentResolutionIndex = hls.currentLevel;
          this.updateActiveResolutionLabel();
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (event: any, data: any) => {
          if (this.currentResolutionIndex === -1) {
            console.log('Hls auto-switched level to:', data.level);
          }
        });

        hls.on(Hls.Events.ERROR, (event: any, data: any) => {
          console.error('HLS error occurred:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                this.setPlayerMode(false);
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
      } else {
        this.setPlayerMode(false);
      }

      video.volume = this.volume;
      video.muted = this.isMuted;
      video.playbackRate = this.currentSpeed;
    };

    setTimeout(tryInit, 50);
  }

  setPlayerMode(isHls: boolean): void {
    this.isHlsMode = isHls;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.progressPercent = 0;
    this.bufferedPercent = 0;

    if (!isHls && this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    if (isHls) {
      this.initializeHlsPlayer();
    }
  }

  togglePlay(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;

    if (video.paused) {
      video.play()
        .then(() => {
          this.isPlaying = true;
        })
        .catch((err) => {
          console.error('Play request failed:', err);
        });
    } else {
      video.pause();
      this.isPlaying = false;
    }
  }

  onPlayStatusChange(playing: boolean): void {
    this.isPlaying = playing;
    if (playing) {
      this.startAmbientGlow();
      this.showControls = true;
      if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
      this.controlsTimeout = setTimeout(() => {
        this.showControls = false;
        this.showResolutionMenu = false;
        this.showSettingsMenu = false;
      }, 5000);
    } else {
      this.stopAmbientGlow();
      this.showControls = true;
      if (this.controlsTimeout) {
        clearTimeout(this.controlsTimeout);
      }
    }
  }

  skipTime(seconds: number): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;

    let newTime = video.currentTime + seconds;
    if (newTime < 0) newTime = 0;
    if (newTime > video.duration) newTime = video.duration;

    video.currentTime = newTime;

    if (this.skipFlashTimeout) clearTimeout(this.skipFlashTimeout);

    if (
      (seconds > 0 && this.skipAccumulator < 0) ||
      (seconds < 0 && this.skipAccumulator > 0)
    ) {
      this.skipAccumulator = 0;
    }

    this.skipAccumulator += seconds;
    const isForward = this.skipAccumulator > 0;
    const absSeconds = Math.abs(this.skipAccumulator);

    this.skipIndicatorText = `${isForward ? '▶▶' : '◀◀'} ${isForward ? '+' : '-'}${absSeconds}s`;
    this.showSkipFlash = true;

    this.triggerZoneRipple(seconds > 0 ? 'right' : 'left');

    this.skipFlashTimeout = setTimeout(() => {
      this.showSkipFlash = false;
      this.skipAccumulator = 0;
    }, 800);
  }

  onSkipZoneClick(event: MouseEvent, direction: 'left' | 'right'): void {
    event.stopPropagation();
    if (this.skipClickTimeout) {
      clearTimeout(this.skipClickTimeout);
      this.skipClickTimeout = null;
      this.skipTime(direction === 'left' ? -10 : 10);
    } else {
      this.skipClickTimeout = setTimeout(() => {
        this.skipClickTimeout = null;
        this.togglePlay();
      }, 250);
    }
  }

  triggerZoneRipple(direction: 'left' | 'right'): void {
    if (direction === 'left') {
      this.showLeftRipple = true;
      if (this.leftRippleTimeout) clearTimeout(this.leftRippleTimeout);
      this.leftRippleTimeout = setTimeout(() => (this.showLeftRipple = false), 600);
    } else {
      this.showRightRipple = true;
      if (this.rightRippleTimeout) clearTimeout(this.rightRippleTimeout);
      this.rightRippleTimeout = setTimeout(() => (this.showRightRipple = false), 600);
    }
  }

  onTimeUpdate(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video || this.isScrubbing) return;

    this.currentTime = video.currentTime;
    if (video.duration) {
      this.progressPercent = (video.currentTime / video.duration) * 100;
    }
    this.updateBufferedPercent();
  }

  onDurationChange(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    this.duration = video.duration || 0;
  }

  updateBufferedPercent(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video || !video.buffered || video.buffered.length === 0 || !video.duration) {
      this.bufferedPercent = 0;
      return;
    }
    const duration = video.duration;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= video.currentTime && video.buffered.end(i) >= video.currentTime) {
        this.bufferedPercent = (video.buffered.end(i) / duration) * 100;
        break;
      }
    }
  }

  onProgressDragStart(event: MouseEvent | TouchEvent): void {
    this.isScrubbing = true;
    this.onProgressDragMove(event);
  }

  @HostListener('document:mousemove', ['$event'])
  @HostListener('document:touchmove', ['$event'])
  onProgressDragMove(event: MouseEvent | TouchEvent): void {
    if (!this.isScrubbing) return;
    const progressEl = this.progressBar?.nativeElement;
    const video = this.videoPlayer?.nativeElement;
    if (!progressEl || !video || !video.duration) return;

    const rect = progressEl.getBoundingClientRect();
    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    let percent = (clientX - rect.left) / rect.width;
    if (percent < 0) percent = 0;
    if (percent > 1) percent = 1;

    this.progressPercent = percent * 100;
    this.currentTime = percent * video.duration;
  }

  @HostListener('document:mouseup')
  @HostListener('document:touchend')
  onProgressDragEnd(): void {
    if (!this.isScrubbing) return;
    this.isScrubbing = false;
    const video = this.videoPlayer?.nativeElement;
    if (!video || !video.duration) return;
    video.currentTime = (this.progressPercent / 100) * video.duration;
  }

  onProgressHover(event: MouseEvent): void {
    const progressEl = this.progressBar?.nativeElement;
    const video = this.videoPlayer?.nativeElement;
    if (!progressEl || !video || !video.duration) return;

    const rect = progressEl.getBoundingClientRect();
    let percent = (event.clientX - rect.left) / rect.width;
    if (percent < 0) percent = 0;
    if (percent > 1) percent = 1;

    const hoverTime = percent * video.duration;
    this.hoverX = event.clientX - rect.left;
    this.hoverTimeText = this.formatTime(hoverTime);
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
    const video = this.videoPlayer?.nativeElement;
    if (video) video.muted = this.isMuted;
  }

  onSliderVolumeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.volume = parseFloat(target.value);
    this.isMuted = this.volume === 0;
    const video = this.videoPlayer?.nativeElement;
    if (video) {
      video.volume = this.volume;
      video.muted = this.isMuted;
    }
  }

  toggleFullscreen(): void {
    const container = this.videoPlayer?.nativeElement?.parentElement;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen()
        .then(() => (this.isFullscreen = true))
        .catch((err) => console.error('Error entering fullscreen:', err));
    } else {
      document.exitFullscreen()
        .then(() => (this.isFullscreen = false))
        .catch((err) => console.error('Error exiting fullscreen:', err));
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen = !!document.fullscreenElement;
  }

  togglePictureInPicture(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;

    if (document.pictureInPictureElement) {
      document.exitPictureInPicture()
        .catch((err) => console.error('Error exiting PiP:', err));
    } else if (document.pictureInPictureEnabled) {
      video.requestPictureInPicture()
        .catch((err) => console.error('Error entering PiP:', err));
    }
  }

  selectResolution(index: number): void {
    this.currentResolutionIndex = index;
    if (this.hls) {
      this.hls.currentLevel = index;
    }
    this.updateActiveResolutionLabel();
    this.showResolutionMenu = false;
  }

  updateActiveResolutionLabel(): void {
    if (this.currentResolutionIndex === -1) {
      this.activeResolutionLabel = 'Auto';
    } else {
      const res = this.availableResolutions.find((r) => r.index === this.currentResolutionIndex);
      this.activeResolutionLabel = res ? res.label.split(' ')[0] : 'Auto';
    }
  }

  toggleSettingsMenu(): void {
    this.showSettingsMenu = !this.showSettingsMenu;
    if (this.showSettingsMenu) this.activeSettingsSubMenu = 'main';
  }

  setPlaySpeed(speed: number): void {
    this.currentSpeed = speed;
    const video = this.videoPlayer?.nativeElement;
    if (video) video.playbackRate = speed;
    this.showSettingsMenu = false;
  }

  setAspectRatio(ratio: string): void {
    this.currentAspectRatio = ratio;
    this.showSettingsMenu = false;
  }

  getSpeedLabel(speed: number): string {
    return speed === 1.0 ? 'Bình thường' : `${speed}x`;
  }

  getBrightnessPercent(): number {
    return Math.round(this.brightness * 100);
  }

  getVolumePercent(): number {
    return Math.round((this.isMuted ? 0 : this.volume) * 100);
  }

  formatTime(seconds: number): string {
    if (isNaN(seconds)) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const pad = (n: number) => (n < 10 ? `0${n}` : n);
    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  onMouseMovePlayer(): void {
    this.showControls = true;
    if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
    this.controlsTimeout = setTimeout(() => {
      if (this.isPlaying) {
        this.showControls = false;
        this.showResolutionMenu = false;
        this.showSettingsMenu = false;
      }
    }, 5000);
  }

  onMouseLeavePlayer(): void {
    if (this.isPlaying) {
      this.showControls = false;
      this.showResolutionMenu = false;
      this.showSettingsMenu = false;
    }
  }

  startAmbientGlow(): void {
    const video = this.videoPlayer?.nativeElement;
    const canvas = this.ambientCanvas?.nativeElement;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.ambientInterval) clearInterval(this.ambientInterval);
    this.ambientInterval = setInterval(() => {
      if (video.paused || video.ended) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }, 150);
  }

  stopAmbientGlow(): void {
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
  }

  onSearch(): void {
    if (!this.selectedSeries) return;
    this.loadEpisodes(this.selectedSeries.id, this.searchQuery);
  }

  toggleCinemaMode(): void {
    this.cinemaMode = !this.cinemaMode;
    if (this.cinemaMode) {
      document.body.classList.add('cartoon-cinema-mode');
    } else {
      document.body.classList.remove('cartoon-cinema-mode');
    }
  }

  getSeriesRatingStars(rating: number): number[] {
    const fullStars = Math.floor(rating);
    return Array(fullStars).fill(0);
  }

  getCleanEpisodeTitle(title: string): string {
    if (!title) return '';
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      return parts[1] || parts[0];
    }
    return title;
  }
}
