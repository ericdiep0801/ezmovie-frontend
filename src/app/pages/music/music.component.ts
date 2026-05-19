import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { MusicService, Track } from '../../services/music.service';
import { LoadingService } from '../../services/loading.service';
import { PopupService } from '../../services/popup.service';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-music',
  templateUrl: './music.component.html',
  styleUrls: ['./music.component.css'],
})
export class MusicComponent implements OnInit, OnDestroy {
  public tracks: Track[] = [];
  public selectedTrack: Track | null = null;
  public searchQuery: string = '';
  public activeGenre: string = 'All';
  public genres: string[] = ['All', 'Pop', 'V-Pop', 'EDM', 'Rock', 'Acoustic'];

  // Search History State
  public searchHistory: string[] = [];
  public showSearchHistory: boolean = false;

  // Pagination State
  public paginatedTracks: Track[] = [];
  public currentPage: number = 1;
  public pageSize: number = 10;

  // Hybrid YouTube Player State
  public ytPlayer: any = null;
  public isPlayerReady: boolean = false;
  public isPlaying: boolean = false;
  public currentTime: number = 0;
  public duration: number = 0;
  public volume: number = 1.0;
  public isMuted: boolean = false;
  public progressPercent: number = 0;
  
  // Interactive View Settings
  public showVideo: boolean = true; // Users can watch MV directly on the right side card!
  public showPopupMode: boolean = false; // Popup mode for high-focus MV watching!
  public showIndicator: boolean = true; // High-end fade out close indicator
  public isScrubbing: boolean = false;
  private indicatorTimeout: any = null;

  // Dynamic Lyrics State
  public currentLyricIndex: number = -1;
  public trackLyrics: string[] = [];

  // Expose Math to template expression
  public Math = Math;

  // Safe Resource URL for YouTube Embed Player
  public safeEmbedUrl: SafeResourceUrl | null = null;

  private timeInterval: any = null;

  constructor(
    private readonly musicService: MusicService,
    private readonly loadingService: LoadingService,
    private readonly popupService: PopupService,
    private readonly sanitizer: DomSanitizer,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTrendingTracks();
    this.loadYouTubeIframeAPI();
    this.loadSearchHistory();
  }

  ngOnDestroy(): void {
    document.body.classList.remove('mv-cinema-mode');
    this.stopTimeInterval();
    this.clearIndicatorTimeout();
    if (this.ytPlayer && this.ytPlayer.destroy) {
      this.ytPlayer.destroy();
    }
  }

  /**
   * Dynamically loads the YouTube Iframe Player API
   */
  private loadYouTubeIframeAPI(): void {
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      (window as any).onYouTubeIframeAPIReady = () => {
        this.initYouTubePlayer();
      };
    } else {
      this.initYouTubePlayer();
    }
  }

  /**
   * Initializes the YouTube Player on the #yt-player container
   */
  private initYouTubePlayer(): void {
    const checkReady = setInterval(() => {
      if ((window as any).YT && (window as any).YT.Player) {
        clearInterval(checkReady);
        
        try {
          this.ytPlayer = new (window as any).YT.Player('yt-player', {
            height: '100%',
            width: '100%',
            videoId: this.selectedTrack ? this.selectedTrack.previewUrl : 'tcS84W-p1q0',
            playerVars: {
              playsinline: 1,
              controls: 0,
              disablekb: 1,
              fs: 0,
              rel: 0,
              modestbranding: 1,
              origin: window.location.origin
            },
            events: {
              onReady: (event: any) => this.onPlayerReady(event),
              onStateChange: (event: any) => this.onPlayerStateChange(event)
            }
          });
        } catch (error) {
          console.error('Failed to init YouTube Player iframe:', error);
        }
      }
    }, 100);
  }

  private onPlayerReady(event: any): void {
    this.isPlayerReady = true;
    event.target.setVolume(this.volume * 100);
    if (this.isMuted) {
      event.target.mute();
    }
    this.cdr.detectChanges();
  }

  private onPlayerStateChange(event: any): void {
    const state = event.data;
    
    // state: 1 = PLAYING, 2 = PAUSED, 0 = ENDED
    if (state === 1) {
      this.isPlaying = true;
      this.startTimeInterval();
    } else if (state === 2) {
      this.isPlaying = false;
      this.stopTimeInterval();
    } else if (state === 0) {
      this.isPlaying = false;
      this.stopTimeInterval();
      this.nextTrack(); // Auto-play next track!
    }
    
    this.cdr.detectChanges();
  }

  private startTimeInterval(): void {
    this.stopTimeInterval();
    this.timeInterval = setInterval(() => {
      if (this.ytPlayer && this.ytPlayer.getCurrentTime) {
        try {
          this.currentTime = this.ytPlayer.getCurrentTime() || 0;
          this.duration = this.ytPlayer.getDuration() || (this.selectedTrack ? this.selectedTrack.durationMs / 1000 : 240);
          this.progressPercent = (this.currentTime / this.duration) * 100;
          
          // Sync lyrics
          const ratio = this.currentTime / (this.duration || 1);
          const index = Math.floor(ratio * this.trackLyrics.length);
          if (index !== this.currentLyricIndex && index < this.trackLyrics.length) {
            this.currentLyricIndex = index;
          }
          this.cdr.detectChanges();
        } catch (e) {
          // Keep silent if player is updating
        }
      }
    }, 250);
  }

  private stopTimeInterval(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
  }

  loadTrendingTracks(): void {
    this.loadingService.show();
    this.musicService.getTrendingTracks().subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          this.tracks = res.data;
          this.onTracksLoaded();
          if (this.tracks.length > 0) {
            this.selectTrack(this.tracks[0], false);
          }
        }
        this.loadingService.hide();
      },
      error: (err) => {
        console.error('Failed to load music tracks', err);
        this.popupService.showError('Không thể kết nối máy chủ âm nhạc.', 'Lỗi hệ thống');
        this.loadingService.hide();
      },
    });
  }

  selectTrack(track: Track, autoPlay: boolean = true): void {
    if (track.isLocked || !track.previewUrl) {
      this.popupService.showError(
        `Bài hát "${track.name}" hiện chưa khả dụng hoặc bị giới hạn bản quyền phát thử.`,
        'Bản quyền giới hạn'
      );
      return;
    }

    this.selectedTrack = track;
    this.safeEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${track.previewUrl}?autoplay=${autoPlay ? 1 : 0}&controls=0&origin=${window.location.origin}`);
    
    // Set up lyrics based on track
    this.generateMockLyrics(track);

    if (this.ytPlayer && this.isPlayerReady) {
      try {
        if (autoPlay) {
          this.ytPlayer.loadVideoById(track.previewUrl);
          this.isPlaying = true;
        } else {
          this.ytPlayer.cueVideoById(track.previewUrl);
          this.isPlaying = false;
        }
      } catch (err) {
        console.error('Failed to cue/load video inside YT player:', err);
      }
    }
  }

  // Visual Control program mappings
  togglePlay(): void {
    if (!this.ytPlayer || !this.isPlayerReady) {
      console.warn('YouTube Player not fully ready. Initializing visual playback fallback...');
      this.initYouTubePlayer();
      
      // Smart Fallback: Toggle visual playback locally so controls respond instantly
      this.isPlaying = !this.isPlaying;
      if (this.isPlaying) {
        this.startTimeInterval();
      } else {
        this.stopTimeInterval();
      }
      this.cdr.detectChanges();
      return;
    }
    
    try {
      if (this.isPlaying) {
        this.ytPlayer.pauseVideo();
      } else {
        this.ytPlayer.playVideo();
      }
    } catch (e) {
      console.error('YT play controls error:', e);
      // Fail-safe fallback state switch
      this.isPlaying = !this.isPlaying;
      if (this.isPlaying) {
        this.startTimeInterval();
      } else {
        this.stopTimeInterval();
      }
      this.cdr.detectChanges();
    }
  }

  nextTrack(): void {
    if (this.tracks.length === 0 || !this.selectedTrack) return;
    const currentIndex = this.tracks.findIndex((t) => t.id === this.selectedTrack?.id);
    let nextIndex = (currentIndex + 1) % this.tracks.length;
    
    // Auto-skip restricted tracks gracefully to ensure continuous playback
    let attempts = 0;
    while ((this.tracks[nextIndex].isLocked || !this.tracks[nextIndex].previewUrl) && attempts < this.tracks.length) {
      nextIndex = (nextIndex + 1) % this.tracks.length;
      attempts++;
    }
    
    if (attempts < this.tracks.length) {
      this.selectTrack(this.tracks[nextIndex], true);
    }
  }

  prevTrack(): void {
    if (this.tracks.length === 0 || !this.selectedTrack) return;
    const currentIndex = this.tracks.findIndex((t) => t.id === this.selectedTrack?.id);
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = this.tracks.length - 1;

    // Auto-skip restricted tracks backwards gracefully
    let attempts = 0;
    while ((this.tracks[prevIndex].isLocked || !this.tracks[prevIndex].previewUrl) && attempts < this.tracks.length) {
      prevIndex = prevIndex - 1;
      if (prevIndex < 0) prevIndex = this.tracks.length - 1;
      attempts++;
    }

    if (attempts < this.tracks.length) {
      this.selectTrack(this.tracks[prevIndex], true);
    }
  }

  toggleMute(): void {
    if (!this.ytPlayer || !this.isPlayerReady) return;
    
    try {
      this.isMuted = !this.isMuted;
      if (this.isMuted) {
        this.ytPlayer.mute();
      } else {
        this.ytPlayer.unMute();
      }
    } catch (e) {}
  }

  toggleVideoMode(): void {
    this.showVideo = !this.showVideo;
    if (!this.showVideo) {
      this.showPopupMode = false;
    }
  }

  togglePopupMode(): void {
    this.showPopupMode = !this.showPopupMode;
    if (this.showPopupMode) {
      document.body.classList.add('mv-cinema-mode');
      this.showIndicator = true;
      this.resetIndicatorTimeout();
    } else {
      document.body.classList.remove('mv-cinema-mode');
      this.clearIndicatorTimeout();
    }
    this.cdr.detectChanges();
  }

  public onBackdropMouseMove(): void {
    if (!this.showPopupMode) return;
    this.showIndicator = true;
    this.resetIndicatorTimeout();
    this.cdr.detectChanges();
  }

  private resetIndicatorTimeout(): void {
    this.clearIndicatorTimeout();
    this.indicatorTimeout = setTimeout(() => {
      this.showIndicator = false;
      this.cdr.detectChanges();
    }, 5000);
  }

  private clearIndicatorTimeout(): void {
    if (this.indicatorTimeout) {
      clearTimeout(this.indicatorTimeout);
      this.indicatorTimeout = null;
    }
  }

  onVolumeChange(event: any): void {
    const val = parseFloat(event.target.value);
    this.volume = val;
    
    if (this.ytPlayer && this.isPlayerReady) {
      try {
        this.ytPlayer.setVolume(val * 100);
        if (val > 0) {
          this.isMuted = false;
          this.ytPlayer.unMute();
        } else {
          this.isMuted = true;
          this.ytPlayer.mute();
        }
      } catch (e) {}
    }
  }

  onProgressDragStart(event: MouseEvent | TouchEvent): void {
    if (event instanceof MouseEvent && event.button !== 0) return; // Only allow left-click dragging
    
    // Prevent default scroll behaviors on touch
    if (event.cancelable) {
      event.preventDefault();
    }
    
    this.isScrubbing = true;
    this.seekProgress(event);

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
    if (!this.ytPlayer || !this.isPlayerReady || !this.duration) return;

    const progressContainer = document.querySelector('.progress-bar-container') as HTMLDivElement;
    if (!progressContainer) return;

    try {
      const rect = progressContainer.getBoundingClientRect();
      let clientX = 0;
      if (event instanceof MouseEvent) {
        clientX = event.clientX;
      } else if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
      } else if (event.changedTouches && event.changedTouches.length > 0) {
        clientX = event.changedTouches[0].clientX;
      } else {
        return;
      }

      const clickX = clientX - rect.left;
      const width = rect.width;
      let percent = clickX / width;
      
      if (percent < 0) percent = 0;
      if (percent > 1) percent = 1;

      const targetSeconds = percent * this.duration;
      this.ytPlayer.seekTo(targetSeconds, true);
      this.currentTime = targetSeconds;
      this.progressPercent = percent * 100;
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Error seeking progress:', e);
    }
  }

  seekRelative(seconds: number): void {
    if (!this.ytPlayer || !this.isPlayerReady || !this.duration) return;

    try {
      let targetTime = this.currentTime + seconds;
      if (targetTime < 0) targetTime = 0;
      if (targetTime > this.duration) targetTime = this.duration;

      this.ytPlayer.seekTo(targetTime, true);
      this.currentTime = targetTime;
      this.progressPercent = (targetTime / this.duration) * 100;
    } catch (e) {
      console.error('Error during relative seek:', e);
    }
  }

  // Genre Filters & Searching
  selectGenre(genre: string): void {
    this.activeGenre = genre;
    this.searchQuery = ''; // Reset search query when switching genres
    
    this.loadingService.show();
    this.musicService.getTrendingTracks().subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          if (genre === 'All') {
            this.tracks = res.data;
          } else {
            this.tracks = res.data.filter((t) => t.genre === genre);
          }
          this.onTracksLoaded();
          if (this.tracks.length > 0) {
            this.selectTrack(this.tracks[0], false);
          } else {
            this.selectedTrack = null;
            this.safeEmbedUrl = null;
          }
        }
        this.loadingService.hide();
      },
      error: () => this.loadingService.hide()
    });
  }

  onSearch(): void {
    const q = this.searchQuery ? this.searchQuery.trim() : '';
    this.activeGenre = 'All'; // Reset genre tabs

    if (!q) {
      this.loadTrendingTracks();
      return;
    }

    this.saveSearchHistory(q); // Save searched keyword to history!

    this.loadingService.show();
    this.musicService.searchTracks(q).subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          this.tracks = res.data;
          this.onTracksLoaded();
          if (this.tracks.length > 0) {
            this.selectTrack(this.tracks[0], false);
          } else {
            this.selectedTrack = null;
            this.safeEmbedUrl = null;
          }
        }
        this.loadingService.hide();
      },
      error: () => this.loadingService.hide(),
    });
  }

  // High-End Music Search History Methods
  get filteredSearchHistory(): string[] {
    if (!this.searchHistory) return [];
    if (!this.searchQuery || !this.searchQuery.trim()) {
      return this.searchHistory;
    }
    const q = this.searchQuery.trim().toLowerCase();
    return this.searchHistory.filter(item => item.toLowerCase().includes(q));
  }

  loadSearchHistory(): void {
    try {
      const saved = localStorage.getItem('ezmovie_music_search_history');
      this.searchHistory = saved ? JSON.parse(saved) : [];
    } catch (e) {
      this.searchHistory = [];
    }
  }

  saveSearchHistory(keyword: string): void {
    if (!keyword || !keyword.trim()) return;
    const cleanKeyword = keyword.trim();
    this.loadSearchHistory();
    this.searchHistory = [
      cleanKeyword,
      ...this.searchHistory.filter(h => h.toLowerCase() !== cleanKeyword.toLowerCase())
    ].slice(0, 8);
    try {
      localStorage.setItem('ezmovie_music_search_history', JSON.stringify(this.searchHistory));
    } catch (e) {}
  }

  deleteSearchHistoryItem(event: Event, item: string): void {
    event.stopPropagation();
    event.preventDefault();
    this.searchHistory = this.searchHistory.filter(h => h !== item);
    try {
      localStorage.setItem('ezmovie_music_search_history', JSON.stringify(this.searchHistory));
    } catch (e) {}
  }

  clearAllSearchHistory(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.searchHistory = [];
    try {
      localStorage.removeItem('ezmovie_music_search_history');
    } catch (e) {}
  }

  selectSearchHistoryItem(event: Event, item: string): void {
    event.stopPropagation();
    event.preventDefault();
    this.searchQuery = item;
    this.showSearchHistory = false;
    this.onSearch();
  }

  onSearchFocus(): void {
    this.loadSearchHistory();
    this.showSearchHistory = true;
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.showSearchHistory = false;
    }, 200);
  }

  // Premium Pagination Handlers
  onTracksLoaded(): void {
    this.currentPage = 1;
    this.updatePaginatedTracks();
  }

  updatePaginatedTracks(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedTracks = this.tracks.slice(startIndex, startIndex + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.tracks.length / this.pageSize);
  }

  getPageNumbers(): number[] {
    const total = this.totalPages;
    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (this.currentPage <= 3) {
      return [1, 2, 3, 4, 5];
    }
    if (this.currentPage >= total - 2) {
      return [total - 4, total - 3, total - 2, total - 1, total];
    }
    return [this.currentPage - 2, this.currentPage - 1, this.currentPage, this.currentPage + 1, this.currentPage + 2];
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePaginatedTracks();
    
    // Auto scroll tracklist into view when switching pages
    const section = document.querySelector('.track-queue-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds === Infinity) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`;
  }

  // Sync high-fidelity gorgeous lyrics generator
  private generateMockLyrics(track: Track): void {
    const songName = track.name;
    const artist = track.artist;

    this.trackLyrics = [
      `🎵 Tác phẩm: ${songName}`,
      `🎤 Trình bày: ${artist}`,
      `✨ Chào mừng bạn đến với EZMOVIE Premium Live Stream ✨`,
      `[Giai điệu mở đầu dạt dào cảm xúc...]`,
      `Màn đêm buông xuống, từng thanh âm bắt đầu vang lên...`,
      `Đường chân trời sáng tỏ ánh đèn chiếu rực rỡ`,
      `Ta nghe tiếng hát dội về từ muôn phương`,
      `[Lời ca cất lên nhẹ nhàng say đắm]`,
      `Tình yêu này trao trọn vào bài hát ngọt ngào`,
      `Từng khoảnh khắc đắm chìm trong thế giới âm nhạc`,
      `Không một lo toan, chỉ có giai điệu bay bổng`,
      `[Đoạn điệp khúc cao trào ngân vang réo rắt]`,
      `Hãy nhắm mắt lại và để âm nhạc dẫn lối trái tim`,
      `Cảm ơn bạn đã đồng hành cùng EZMOVIE Premium!`,
      `[Nhạc dạo kết thúc êm dịu kéo dài...]`
    ];
    this.currentLyricIndex = 0;
  }
}
