import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  HostListener,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MovieService } from '../../services/movie.service';
import { AuthService } from '../../services/auth.service';
import { LoadingService } from '../../services/loading.service';
import { PopupService } from '../../services/popup.service';
import { environment } from '../../../environments/environment';

declare const Hls: any;

@Component({
  selector: 'app-movie-detail',
  templateUrl: './movie-detail.component.html',
  styleUrls: ['./movie-detail.component.css'],
})
export class MovieDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  public environment = environment;
  public movie: any = null;
  public episodes: any[] = [];
  public selectedEpisode: any = null;
  public isFavorited: boolean = false;
  public isLoggedIn: boolean = false;
  public isSessionValid: boolean = true;

  // Custom Video Player states
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;
  @ViewChild('progressBar') progressBar!: ElementRef<HTMLDivElement>;
  @ViewChild('ambientCanvas') ambientCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('previewVideo') previewVideo!: ElementRef<HTMLVideoElement>;

  public isHlsMode: boolean = true;
  public isPlaying: boolean = false;
  public currentTime: number = 0;
  public duration: number = 0;
  private lastSaveTime: number = 0;

  // New interactive player features
  public isScrubbing: boolean = false;

  public showHoverTime: boolean = false;
  public hoverX: number = 0;
  public hoverTimeText: string = '00:00';

  private ambientInterval: any = null;
  public volume: number = 1;
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

  // Settings menu (Play Speed & Aspect Ratio)
  public showSettingsMenu: boolean = false;
  public activeSettingsSubMenu: 'main' | 'speed' | 'aspect' = 'main';
  public currentSpeed: number = 1.0;
  public availableSpeeds: number[] = [0.5, 1.0, 1.25, 1.5, 2.0];
  public currentAspectRatio: string = 'Default';
  public availableAspectRatios: string[] = ['Default', '16:9', '4:3', 'Fill'];
  public skipAccumulator: number = 0;

  // Drag gestures (Brightness / Volume)
  public brightness: number = 1.0;
  public showLeftOverlayValue: boolean = false;
  public showRightOverlayValue: boolean = false;
  public leftOverlayText: string = '';
  public rightOverlayText: string = '';

  private dragStartY: number = 0;
  private dragStartValue: number = 0;
  private isDragging: boolean = false;
  private dragZone: 'left' | 'right' | null = null;
  public hasDraggedSignificant: boolean = false;

  private hls: any = null;
  private previewHls: any = null;
  private controlsTimeout: any = null;
  private skipFlashTimeout: any = null;
  private leftRippleTimeout: any = null;
  private rightRippleTimeout: any = null;
  private overlayValueTimeout: any = null;
  private lastPreviewSeekTime: number = 0;
  private previewSeekTimeout: any = null;
  private skipClickTimeout: any = null;
  private historySavedKey: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private movieService: MovieService,
    private authService: AuthService,
    private loadingService: LoadingService,
    private popupService: PopupService,
  ) {}

  ngAfterViewInit(): void {
    if (this.isHlsMode && this.selectedEpisode) {
      this.initializeHlsPlayer();
    }
  }

  ngOnDestroy(): void {
    this.saveProgress();
    document.body.style.overflow = '';
    if (this.hls) {
      this.hls.destroy();
    }
    if (this.previewHls) {
      this.previewHls.destroy();
    }
    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout);
    }
    if (this.skipFlashTimeout) {
      clearTimeout(this.skipFlashTimeout);
    }
    if (this.leftRippleTimeout) {
      clearTimeout(this.leftRippleTimeout);
    }
    if (this.rightRippleTimeout) {
      clearTimeout(this.rightRippleTimeout);
    }
    if (this.overlayValueTimeout) {
      clearTimeout(this.overlayValueTimeout);
    }
    if (this.previewSeekTimeout) {
      clearTimeout(this.previewSeekTimeout);
    }
    if (this.skipClickTimeout) {
      clearTimeout(this.skipClickTimeout);
    }
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
    }
  }

  ngOnInit(): void {
    // Check if user is logged in
    this.authService.currentUser$.subscribe((user) => {
      this.isLoggedIn = !!user;
    });

    // Load movie based on slug in URL
    this.route.params.subscribe((params) => {
      const slug = params['slug'];
      if (slug) {
        this.loadMovie(slug);
      }
    });
  }

  loadMovie(slug: string): void {
    this.loadingService.show();
    this.movieService.getMovieDetails(slug).subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          this.movie = res.data.movie;
          this.episodes = res.data.episodes || [];

          // Select episode from query param (?ep=...) if present to continue watching
          this.route.queryParams.subscribe((queryParams) => {
            const epParam = queryParams['ep'];
            let selectedEp = null;

            if (epParam && this.episodes.length > 0) {
              for (const server of this.episodes) {
                const matched = server.server_data?.find(
                  (item: any) => item.slug === epParam,
                );
                if (matched) {
                  selectedEp = matched;
                  break;
                }
              }
            }

            if (selectedEp) {
              this.selectEpisode(selectedEp);
            } else if (
              this.episodes.length > 0 &&
              this.episodes[0].server_data?.length > 0
            ) {
              this.selectEpisode(this.episodes[0].server_data[0]);
            }
          });

          // Check if this movie is favorited
          if (this.isLoggedIn) {
            this.checkFavoriteStatus(slug);
          }

          // Load comments for the movie
          this.loadComments(slug);
        } else {
          this.popupService.showError(
            'Không thể tìm thấy phim này hoặc đã xảy ra lỗi.',
            'Lỗi tìm phim',
          );
          this.router.navigate(['/home']);
        }
        this.loadingService.hide();
      },
      error: (err) => {
        console.error('Failed to load movie details', err);
        this.popupService.showError(
          'Đã xảy ra lỗi khi kết nối máy chủ.',
          'Lỗi hệ thống',
        );
        this.router.navigate(['/home']);
        this.loadingService.hide();
      },
    });
  }

  checkFavoriteStatus(slug: string): void {
    this.movieService.checkFavorite(slug).subscribe({
      next: (res) => {
        if (res.status === 200) {
          this.isFavorited = res.isFavorited;
          this.isSessionValid = true;
        }
      },
      error: (err) => {
        console.error('Failed to check favorite status', err);
        if (err.status === 401) {
          this.isSessionValid = false;
        }
      },
    });
  }

  selectEpisode(episode: any): void {
    this.selectedEpisode = episode;

    // Update URL query parameter 'ep' dynamically without reloading the component
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ep: episode.slug },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    // Reset so history is saved again when user successfully plays this episode
    this.historySavedKey = null;

    // Embed mode has no play event — treat episode load as a successful watch
    const useEmbed = !this.isHlsMode || !episode.link_m3u8;
    if (useEmbed) {
      this.saveWatchHistoryOnPlaySuccess();
    }

    // Initialize HLS player for the selected episode if in HLS mode
    if (this.isHlsMode) {
      this.initializeHlsPlayer();
    }
  }

  get currentServerData(): any[] {
    if (!this.selectedEpisode || !this.episodes) return [];
    for (const server of this.episodes) {
      if (server.server_data?.some((ep: any) => ep.slug === this.selectedEpisode.slug)) {
        return server.server_data;
      }
    }
    return [];
  }

  get currentEpisodeIndex(): number {
    const data = this.currentServerData;
    if (!data) return -1;
    return data.findIndex((ep: any) => ep.slug === this.selectedEpisode?.slug);
  }

  get hasPrevEpisode(): boolean {
    return this.currentEpisodeIndex > 0;
  }

  get hasNextEpisode(): boolean {
    const data = this.currentServerData;
    return this.currentEpisodeIndex !== -1 && this.currentEpisodeIndex < data.length - 1;
  }

  playPrevEpisode(): void {
    if (this.hasPrevEpisode) {
      this.selectEpisode(this.currentServerData[this.currentEpisodeIndex - 1]);
    }
  }

  playNextEpisode(): void {
    if (this.hasNextEpisode) {
      this.selectEpisode(this.currentServerData[this.currentEpisodeIndex + 1]);
    }
  }

  goBack(event: Event): void {
    event.preventDefault();
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/home']);
    }
  }

  toggleFavorite(): void {
    if (!this.isLoggedIn) {
      this.popupService.showConfirm(
        'Bạn cần đăng nhập để lưu phim yêu thích. Đi tới trang Đăng nhập?',
        'Yêu cầu Đăng nhập',
        () => {
          this.router.navigate(['/login']);
        },
        'Đăng nhập',
        'Hủy',
      );
      return;
    }

    const dto = {
      movieSlug: this.movie.slug,
      movieName: this.movie.name,
      moviePoster: this.movie.poster_url || this.movie.thumb_url,
      movieType: this.movie.type,
    };

    this.movieService.toggleFavorite(dto).subscribe({
      next: (res) => {
        if (res.status === 200) {
          this.isFavorited = res.isFavorited;
          const msg = this.isFavorited
            ? 'Đã thêm phim vào danh sách yêu thích!'
            : 'Đã xóa phim khỏi danh sách yêu thích.';
          this.popupService.showSuccess(msg, 'Lưu Phim');
        }
      },
      error: (err) => {
        console.error('Failed to toggle favorite', err);
        const errMsg = err.error?.message || err.message || 'Lỗi kết nối';
        this.popupService.showError(
          `Không thể thực hiện lưu phim lúc này.\nLỗi: ${err.status} - ${errMsg}`,
          'Lỗi yêu thích',
        );
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  handleSessionExpiredLogin(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // ==========================================
  // MOVIE COMMENTS SYSTEM (FRONTEND LOGIC)
  // ==========================================
  public commentsList: any[] = [];
  public commentContent: string = '';

  loadComments(slug: string): void {
    this.movieService.listComments(slug).subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          this.commentsList = res.data;
        }
      },
      error: (err) => {
        console.error('Failed to load movie comments', err);
      },
    });
  }

  submitComment(): void {
    if (!this.isLoggedIn) {
      this.popupService.showError(
        'Bạn cần đăng nhập mới có thể bình luận!',
        'Yêu Cầu Đăng Nhập',
      );
      return;
    }
    if (!this.commentContent || !this.commentContent.trim()) {
      this.popupService.showError(
        'Nội dung bình luận không được trống!',
        'Lỗi',
      );
      return;
    }

    this.movieService
      .addComment(this.movie.slug, this.commentContent)
      .subscribe({
        next: (res) => {
          if (res.status === 200) {
            this.commentContent = '';
            this.loadComments(this.movie.slug);
            this.popupService.showSuccess(
              'Đã gửi bình luận thành công!',
              'Thành công',
            );
          }
        },
        error: (err) => {
          console.error('Failed to submit comment', err);
          this.popupService.showError(
            'Không thể gửi bình luận lúc này.',
            'Lỗi',
          );
        },
      });
  }

  toggleLikeComment(comment: any): void {
    if (!this.isLoggedIn) {
      this.popupService.showError(
        'Bạn cần đăng nhập để tương tác bình luận!',
        'Yêu Cầu Đăng Nhập',
      );
      return;
    }

    this.movieService.toggleLikeComment(comment.id).subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          comment.likesCount = res.data.likesCount;
          comment.hasLiked = res.data.hasLiked;
        }
      },
      error: (err) => {
        console.error('Failed to toggle comment like', err);
      },
    });
  }

  // ==========================================
  // CUSTOM HLS VIP VIDEO PLAYER METHODS
  // ==========================================
  initializeHlsPlayer(): void {
    if (!this.selectedEpisode || !this.selectedEpisode.link_m3u8) {
      console.warn('No m3u8 streaming link found for this episode.');
      return;
    }

    let retryCount = 0;
    const tryInit = () => {
      const video = this.videoPlayer?.nativeElement;
      if (!video) {
        if (retryCount < 10) {
          retryCount++;
          setTimeout(tryInit, 100);
        } else {
          console.error('Failed to locate videoPlayer element after retries.');
        }
        return;
      }

      // Cleanup existing HLS instances
      if (this.hls) {
        this.hls.destroy();
        this.hls = null;
      }
      if (this.previewHls) {
        this.previewHls.destroy();
        this.previewHls = null;
      }

      const streamUrl = this.selectedEpisode.link_m3u8;
      console.log('Initializing HLS with stream:', streamUrl);

      const previewVideo = this.previewVideo?.nativeElement;

      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        // 1. Primary player
        const hls = new Hls({
          maxMaxBufferLength: 30,
          enableWorker: true,
          lowLatencyMode: true,
        });
        this.hls = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('HLS Manifest parsed');
          this.availableResolutions = [];
          if (hls.levels && hls.levels.length > 0) {
            this.availableResolutions = hls.levels.map(
              (level: { height: number; bitrate: number }, index: number) => {
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
              },
            );
            this.availableResolutions.sort((a, b) => b.height - a.height);
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
                console.log('Fatal network error, trying to recover...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('Fatal media error, trying to recover...');
                hls.recoverMediaError();
                break;
              default:
                console.error(
                  'Unrecoverable HLS error, switching to Embed player mode',
                );
                this.setPlayerMode(false);
                break;
            }
          }
        });

        // 2. Hover preview player (lightweight HLS client)
        if (previewVideo) {
          const previewHls = new Hls({
            maxMaxBufferLength: 5,
            enableWorker: true,
            lowLatencyMode: true,
          });
          this.previewHls = previewHls;
          previewHls.loadSource(streamUrl);
          previewHls.attachMedia(previewVideo);
        }
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        if (previewVideo) {
          previewVideo.src = streamUrl;
        }
      } else {
        console.warn(
          'HLS is not supported in this browser. Switching to Embed player mode.',
        );
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

    // Cleanup if switching off Hls
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
      video
        .play()
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

  private saveWatchHistoryOnPlaySuccess(): void {
    if (!this.authService.isLoggedIn() || !this.movie || !this.selectedEpisode) {
      return;
    }

    const key = `${this.movie.slug}:${this.selectedEpisode.slug}`;
    if (this.historySavedKey === key) {
      return;
    }
    this.historySavedKey = key;

    this.movieService
      .addWatchHistory({
        movieSlug: this.movie.slug,
        movieName: this.movie.name,
        moviePoster: this.movie.poster_url || this.movie.thumb_url,
        episodeName: this.selectedEpisode.name,
        episodeSlug: this.selectedEpisode.slug,
      })
      .subscribe({
        next: (res) => {
          console.log('Saved watch history:', res.message);
        },
        error: (err) => {
          this.historySavedKey = null;
          console.error(
            'Failed to save watch history. Status:',
            err.status,
            err,
          );
        },
      });
  }

  onPlayStatusChange(playing: boolean): void {
    this.isPlaying = playing;
    if (playing) {
      this.saveWatchHistoryOnPlaySuccess();
      this.startAmbientGlow();
      // Start controls auto-hide timer immediately upon play
      this.showControls = true;
      if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
      const delay = this.isFullscreen ? 5000 : 3000;
      this.controlsTimeout = setTimeout(() => {
        this.showControls = false;
      }, delay);
    } else {
      this.stopAmbientGlow();
      this.historySavedKey = null;
      // Keep controls visible when paused
      this.showControls = true;
      if (this.controlsTimeout) {
        clearTimeout(this.controlsTimeout);
      }
      this.saveProgress(); // Save progress on pause!
    }
  }

  skipTime(seconds: number): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;

    let newTime = video.currentTime + seconds;
    if (newTime < 0) newTime = 0;
    if (newTime > video.duration) newTime = video.duration;

    video.currentTime = newTime;

    // Perform skip accumulation logic
    if (this.skipFlashTimeout) {
      clearTimeout(this.skipFlashTimeout);
    }

    // Reset skipAccumulator if skip direction changes
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

    // Trigger zone ripple visual effect
    const direction = seconds > 0 ? 'right' : 'left';
    this.triggerZoneRipple(direction);

    this.skipFlashTimeout = setTimeout(() => {
      this.showSkipFlash = false;
      this.skipAccumulator = 0;
    }, 800);
  }

  onSkipZoneClick(event: MouseEvent, direction: 'left' | 'right'): void {
    event.stopPropagation();

    // If a significant vertical swipe/drag occurred, do not trigger skip 10s!
    if (this.hasDraggedSignificant) {
      this.hasDraggedSignificant = false; // Reset for next interaction
      return;
    }

    if (this.skipClickTimeout) {
      // Double click: Fast forward / rewind (tua nhanh)
      clearTimeout(this.skipClickTimeout);
      this.skipClickTimeout = null;

      const seconds = direction === 'left' ? -10 : 10;
      this.skipTime(seconds);
    } else {
      // First click: Start double-click detection timer
      this.skipClickTimeout = setTimeout(() => {
        this.skipClickTimeout = null;
        // Single click: Pause / Play (dừng/phát)
        this.togglePlay();
      }, 250);
    }
  }

  // Drag adjustment methods (Swipe up/down)
  onDragStart(event: MouseEvent | TouchEvent, zone: 'left' | 'right'): void {
    if (event instanceof MouseEvent && event.button !== 0) return;

    this.isDragging = true;
    this.dragZone = zone;
    this.hasDraggedSignificant = false;

    const clientY =
      event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;
    this.dragStartY = clientY;

    if (zone === 'left') {
      this.dragStartValue = this.brightness;
    } else {
      this.dragStartValue = this.volume;
    }

    // Prevent default browser drag-and-drop or select behaviors
    if (event instanceof MouseEvent) {
      event.preventDefault();
    }
  }

  @HostListener('document:mousemove', ['$event'])
  @HostListener('document:touchmove', ['$event'])
  onDragMove(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging || !this.dragZone) return;

    const clientY =
      event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;
    const deltaY = this.dragStartY - clientY; // Swipe up increases value

    // Minimum displacement to consider this a drag gesture
    if (Math.abs(deltaY) > 8) {
      this.hasDraggedSignificant = true;
    }

    if (!this.hasDraggedSignificant) return;

    // Prevent double scroll gestures on mobile
    if (event.cancelable) {
      event.preventDefault();
    }

    const sensitivity = 200; // 200 pixels displacement for a 100% change
    const change = deltaY / sensitivity;

    if (this.dragZone === 'left') {
      // Swipe Left = Brightness (0.2 to 2.0)
      let targetBrightness = this.dragStartValue + change;
      if (targetBrightness < 0.2) targetBrightness = 0.2;
      if (targetBrightness > 2.0) targetBrightness = 2.0;

      // Magnetic snapping to 1.0 (standard) within a 0.05 threshold
      if (Math.abs(targetBrightness - 1.0) < 0.05) {
        targetBrightness = 1.0;
      }

      this.brightness = targetBrightness;

      const percent = Math.round(this.brightness * 100);
      this.leftOverlayText = `Độ sáng: ${percent}%`;
      this.showLeftOverlayValue = true;
      this.showRightOverlayValue = false;
    } else {
      // Swipe Right = Volume (0.0 to 1.0)
      let targetVolume = this.dragStartValue + change;
      if (targetVolume < 0) targetVolume = 0;
      if (targetVolume > 1) targetVolume = 1;

      // Magnetic snapping to 0.5 (standard) within a 0.03 threshold
      if (Math.abs(targetVolume - 0.5) < 0.03) {
        targetVolume = 0.5;
      }

      this.volume = targetVolume;
      this.onVolumeChange();

      const percent = Math.round(this.volume * 100);
      this.rightOverlayText = `Âm lượng: ${percent}%`;
      this.showRightOverlayValue = true;
      this.showLeftOverlayValue = false;
    }
  }

  @HostListener('document:mouseup')
  @HostListener('document:touchend')
  onDragEnd(): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.dragZone = null;

    if (this.overlayValueTimeout) {
      clearTimeout(this.overlayValueTimeout);
    }
    this.overlayValueTimeout = setTimeout(() => {
      this.showLeftOverlayValue = false;
      this.showRightOverlayValue = false;
    }, 1500);
  }

  triggerZoneRipple(direction: 'left' | 'right'): void {
    if (direction === 'left') {
      this.showLeftRipple = false;
      setTimeout(() => {
        this.showLeftRipple = true;
      }, 10);

      if (this.leftRippleTimeout) clearTimeout(this.leftRippleTimeout);
      this.leftRippleTimeout = setTimeout(() => {
        this.showLeftRipple = false;
      }, 800);
    } else {
      this.showRightRipple = false;
      setTimeout(() => {
        this.showRightRipple = true;
      }, 10);

      if (this.rightRippleTimeout) clearTimeout(this.rightRippleTimeout);
      this.rightRippleTimeout = setTimeout(() => {
        this.showRightRipple = false;
      }, 800);
    }
  }

  onTimeUpdate(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;

    this.currentTime = video.currentTime;

    if (video.duration) {
      this.progressPercent = (video.currentTime / video.duration) * 100;

      // Throttle saving progress to localStorage (every 3 seconds)
      const now = Date.now();
      if (!this.lastSaveTime || now - this.lastSaveTime > 3000) {
        this.saveProgress();
        this.lastSaveTime = now;
      }
    }

    if (video.buffered && video.buffered.length > 0 && video.duration) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      this.bufferedPercent = (bufferedEnd / video.duration) * 100;
    }
  }

  saveProgress(): void {
    if (!this.movie || !this.selectedEpisode || !this.duration) return;
    const progress = {
      progressPercent: this.progressPercent,
      currentTime: this.currentTime,
      duration: this.duration,
      episodeSlug: this.selectedEpisode.slug,
      episodeName: this.selectedEpisode.name,
      updatedAt: Date.now(),
    };

    const allProgress = JSON.parse(
      localStorage.getItem('movie_progress') || '{}',
    );
    allProgress[this.movie.slug] = progress;
    localStorage.setItem('movie_progress', JSON.stringify(allProgress));
  }

  onResumeWatch(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;

    const allProgress = JSON.parse(
      localStorage.getItem('movie_progress') || '{}',
    );
    const saved = allProgress[this.movie.slug];
    if (
      saved &&
      saved.episodeSlug === this.selectedEpisode.slug &&
      saved.currentTime
    ) {
      video.currentTime = saved.currentTime;
      console.log(`Resumed playback at ${saved.currentTime}s`);
    }
  }

  selectResolution(index: number): void {
    this.currentResolutionIndex = index;
    if (this.hls) {
      this.hls.currentLevel = index;
      console.log('Manually set resolution index to:', index);
    }
    this.updateActiveResolutionLabel();
    this.showResolutionMenu = false;

    const label =
      this.availableResolutions.find((r) => r.index === index)?.label || 'Auto';
    this.popupService.showSuccess(
      `Đã chuyển sang độ phân giải: ${label}`,
      'Độ Phân Giải',
    );
  }

  updateActiveResolutionLabel(): void {
    if (this.currentResolutionIndex === -1) {
      this.activeResolutionLabel = 'Auto';
    } else {
      const active = this.availableResolutions.find(
        (r) => r.index === this.currentResolutionIndex,
      );
      this.activeResolutionLabel = active ? `${active.height}p` : 'Auto';
    }
  }

  toggleSettingsMenu(): void {
    this.showSettingsMenu = !this.showSettingsMenu;
    this.activeSettingsSubMenu = 'main';
  }

  setPlaySpeed(speed: number): void {
    this.currentSpeed = speed;
    const video = this.videoPlayer?.nativeElement;
    if (video) {
      video.playbackRate = speed;
    }
    this.activeSettingsSubMenu = 'main';
    this.showSettingsMenu = false;
    this.popupService.showSuccess(
      `Đã đổi tốc độ phát sang: ${speed === 1.0 ? 'Bình thường' : speed + 'x'}`,
      'Tốc Độ Phát',
    );
  }

  getSpeedLabel(speed: number): string {
    return speed === 1.0 ? 'Normal' : `${speed}x`;
  }

  setAspectRatio(ratio: string): void {
    this.currentAspectRatio = ratio;
    this.activeSettingsSubMenu = 'main';
    this.showSettingsMenu = false;
    this.popupService.showSuccess(
      `Đã chỉnh tỷ lệ khung hình: ${ratio === 'Default' ? 'Mặc định' : (ratio === 'Fill' ? 'Tràn viền' : ratio)}`,
      'Tỷ Lệ Khung Hình',
    );
  }

  onDurationChange(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    this.duration = video.duration || 0;
  }

  onProgressDragStart(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.isScrubbing = true;
    this.seekProgress(event);

    // Bind document mousemove/mouseup or touchmove/touchend listeners
    const onDragMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (this.isScrubbing) {
        this.seekProgress(moveEvent);
      }
    };

    const onDragEnd = () => {
      this.isScrubbing = false;
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      document.removeEventListener('touchmove', onDragMove);
      document.removeEventListener('touchend', onDragEnd);
    };

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove, { passive: true });
    document.addEventListener('touchend', onDragEnd);
  }

  seekProgress(event: MouseEvent | TouchEvent): void {
    const video = this.videoPlayer?.nativeElement;
    const progressContainer = this.progressBar?.nativeElement;
    if (!video || !progressContainer || !this.duration) return;

    const rect = progressContainer.getBoundingClientRect();

    let clientX = 0;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
    } else if (event.touches && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
    } else {
      return;
    }

    let clickX = clientX - rect.left;
    const width = rect.width;

    let clickPercent = clickX / width;
    if (clickPercent < 0) clickPercent = 0;
    if (clickPercent > 1) clickPercent = 1;

    // Update video time instantly for ultra responsive sliding!
    video.currentTime = clickPercent * this.duration;
    this.progressPercent = clickPercent * 100;
  }

  toggleMute(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;

    this.isMuted = !this.isMuted;
    video.muted = this.isMuted;
  }

  onVolumeChange(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;

    video.volume = this.volume;
    if (this.volume > 0) {
      this.isMuted = false;
      video.muted = false;
    }
  }

  onSliderVolumeChange(event: any): void {
    const val = parseFloat(event.target.value);
    this.volume = val;
    const video = this.videoPlayer?.nativeElement;

    if (val > 0) {
      this.isMuted = false;
      if (video) video.muted = false;
    } else {
      this.isMuted = true;
      if (video) video.muted = true;
    }
    this.onVolumeChange();
  }

  isFakeFullscreen: boolean = false;

  isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  toggleFullscreen(): void {
    const container = this.videoPlayer?.nativeElement?.parentElement as any;
    const video = this.videoPlayer?.nativeElement as any;
    if (!container || !video) return;

    if (this.isMobile()) {
      this.isFakeFullscreen = !this.isFakeFullscreen;
      this.isFullscreen = this.isFakeFullscreen;
      
      // Lock or unlock body scroll to prevent background scrolling during fake fullscreen
      if (this.isFakeFullscreen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return;
    }

    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      if (container.requestFullscreen) {
        container
          .requestFullscreen()
          .then(() => {
            this.isFullscreen = true;
            try {
              if (screen && (screen as any).orientation && (screen as any).orientation.lock) {
                (screen as any).orientation.lock('landscape').catch((err: any) => console.warn('Orientation lock failed:', err));
              }
            } catch (e) {}
          })
          .catch((err: any) => {
            console.error('Fullscreen request failed:', err);
          });
      }
    } else {
      if (document.exitFullscreen) {
        document
          .exitFullscreen()
          .then(() => {
            this.isFullscreen = false;
            try {
              if (screen && (screen as any).orientation && (screen as any).orientation.unlock) {
                (screen as any).orientation.unlock();
              }
            } catch (e) {}
          })
          .catch((err) => {
            console.error('Exit fullscreen failed:', err);
          });
      }
    }
  }

  formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds === Infinity) return '00:00';

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const formatNum = (num: number) => (num < 10 ? '0' + num : num);

    if (hrs > 0) {
      return `${formatNum(hrs)}:${formatNum(mins)}:${formatNum(secs)}`;
    }
    return `${formatNum(mins)}:${formatNum(secs)}`;
  }

  onMouseMovePlayer(): void {
    this.showControls = true;
    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout);
    }

    if (this.isPlaying) {
      const delay = this.isFullscreen ? 5000 : 3000;
      this.controlsTimeout = setTimeout(() => {
        this.showControls = false;
        this.showResolutionMenu = false;
        this.showSettingsMenu = false;
      }, delay);
    }
  }

  onMouseLeavePlayer(): void {
    if (this.isPlaying) {
      this.showControls = false;
      this.showResolutionMenu = false;
      this.showSettingsMenu = false;
    }
  }

  @HostListener('document:fullscreenchange', ['$event'])
  onFullscreenChange(_event?: Event): void {
    this.isFullscreen = !!document.fullscreenElement;
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (!this.isHlsMode || !this.selectedEpisode) return;

    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA')
    ) {
      return;
    }

    switch (event.key) {
      case ' ':
        event.preventDefault();
        this.togglePlay();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.skipTime(10);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.skipTime(-10);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.volume = Math.min(1, this.volume + 0.05);
        this.onVolumeChange();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.volume = Math.max(0, this.volume - 0.05);
        this.onVolumeChange();
        break;
      case 'f':
      case 'F':
        event.preventDefault();
        this.toggleFullscreen();
        break;
    }
  }

  togglePictureInPicture(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;

    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch((err) => {
        console.error('Exit PiP failed:', err);
      });
    } else if (document.pictureInPictureEnabled) {
      video.requestPictureInPicture().catch((err) => {
        console.error('Request PiP failed:', err);
      });
    } else {
      this.popupService.showError(
        'Trình duyệt của bạn không hỗ trợ Picture-in-Picture.',
        'Lỗi PiP',
      );
    }
  }

  onProgressHover(event: MouseEvent): void {
    const progressContainer = this.progressBar?.nativeElement;
    if (!progressContainer || !this.duration) return;

    const rect = progressContainer.getBoundingClientRect();
    let x = event.clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;

    this.hoverX = x;

    const hoverPercent = x / rect.width;
    const targetTime = hoverPercent * this.duration;
    this.hoverTimeText = this.formatTime(targetTime);

    this.seekPreviewDebounced(targetTime);
  }

  seekPreviewDebounced(targetTime: number): void {
    if (this.previewSeekTimeout) {
      clearTimeout(this.previewSeekTimeout);
    }

    const now = Date.now();
    const timeSinceLastSeek = now - this.lastPreviewSeekTime;

    if (timeSinceLastSeek >= 120) {
      const previewVideo = this.previewVideo?.nativeElement;
      if (previewVideo) {
        previewVideo.currentTime = targetTime;
        this.lastPreviewSeekTime = now;
      }
    } else {
      this.previewSeekTimeout = setTimeout(() => {
        const previewVideo = this.previewVideo?.nativeElement;
        if (previewVideo) {
          previewVideo.currentTime = targetTime;
          this.lastPreviewSeekTime = Date.now();
        }
      }, 120 - timeSinceLastSeek);
    }
  }

  getBrightnessPercent(): number {
    return Math.round(this.brightness * 100);
  }

  getVolumePercent(): number {
    return Math.round((this.isMuted ? 0 : this.volume) * 100);
  }

  startAmbientGlow(): void {
    const video = this.videoPlayer?.nativeElement;
    const canvas = this.ambientCanvas?.nativeElement;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    canvas.width = 16;
    canvas.height = 9;

    const drawFrame = () => {
      if (video.paused || video.ended || !this.isHlsMode) {
        this.stopAmbientGlow();
        return;
      }
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (e) {
        // Handle cross-origin canvas errors gracefully to prevent crashing
        this.stopAmbientGlow();
      }
    };

    if (this.ambientInterval) clearInterval(this.ambientInterval);
    this.ambientInterval = setInterval(drawFrame, 100); // Throttled to 10fps for ultimate smooth color morphing with 0% CPU impact
  }

  stopAmbientGlow(): void {
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
  }
}
