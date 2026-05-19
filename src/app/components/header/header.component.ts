import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { AuthService, User } from '../../services/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { LoadingService } from '../../services/loading.service';
import { PopupService } from '../../services/popup.service';
import { ChangePasswordService } from '../../services/change-password.service';
import { UpdateProfileService } from '../../services/update-profile.service';
import { MovieService } from '../../services/movie.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
  currentUser: User | null = null;
  isProfileOpen = false;
  isScrolled = false;
  isVisible = true;
  searchQuery: string = '';
  watchHistory: any[] = [];
  searchHistory: string[] = [];
  showSearchHistory = false;
  
  // Real-time synchronization tab state
  activeTab: 'history' | 'favorites' = 'history';
  favoritesList: any[] = [];

  constructor(
    public authService: AuthService,
    private router: Router,
    private eRef: ElementRef,
    private loadingService: LoadingService,
    private popupService: PopupService,
    private changePasswordService: ChangePasswordService,
    private updateProfileService: UpdateProfileService,
    private movieService: MovieService,
  ) {
    // Initial check
    const currentUrl = window.location.pathname;
    const authRoutes = [
      '/login',
      '/signup',
      '/forgot-password',
      '/change-password',
    ];
    this.isVisible = !authRoutes.includes(currentUrl);

    // Initial search sync
    try {
      const parsed = this.router.parseUrl(window.location.search || '');
      const q = parsed.queryParams['q'];
      this.searchQuery = q ? q : '';
    } catch(e) {}

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.isVisible = !authRoutes.includes(event.urlAfterRedirects);
        
        // Sync search input with URL search parameter
        try {
          const parsed = this.router.parseUrl(event.urlAfterRedirects);
          const q = parsed.queryParams['q'];
          this.searchQuery = q ? q : '';
        } catch(e) {}
      });
  }

  ngOnInit(): void {
    this.loadSearchHistory();
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      if (user) {
        this.loadHistory();
        this.loadFavorites();
      } else {
        this.watchHistory = [];
        this.favoritesList = [];
      }
    });

    // Sync watch history dropdown on header in real-time
    this.movieService.historyUpdated$.subscribe(() => {
      if (this.currentUser) {
        this.loadHistory();
      }
    });

    // Sync favorites dropdown on header in real-time
    this.movieService.favoriteUpdated$.subscribe(() => {
      if (this.currentUser) {
        this.loadFavorites();
      }
    });
  }

  loadHistory() {
    this.movieService.listWatchHistory().subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          this.watchHistory = res.data.slice(0, 10);
        }
      },
      error: (err) => console.error('Failed to load history in header', err)
    });
  }

  loadFavorites() {
    this.movieService.listFavorites().subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          this.favoritesList = res.data.slice(0, 10);
        }
      },
      error: (err) => console.error('Failed to load favorites in header', err)
    });
  }

  goToMovie(slug: string, episodeSlug?: string) {
    this.isProfileOpen = false;
    if (episodeSlug) {
      this.router.navigate(['/movie', slug], { queryParams: { ep: episodeSlug } });
    } else {
      this.router.navigate(['/movie', slug]);
    }
  }

  unfavoriteMovie(event: Event, slug: string) {
    event.stopPropagation(); // Stop click from navigating to details page
    this.popupService.showConfirm(
      'Bạn có chắc chắn muốn bỏ thích bộ phim này?',
      'Bỏ phim yêu thích',
      () => {
        this.loadingService.show();
        this.movieService.removeFavorite(slug).subscribe({
          next: (res) => {
            this.loadingService.hide();
            this.popupService.showSuccess('Đã bỏ thích phim thành công!', 'Thành công');
          },
          error: (err) => {
            this.loadingService.hide();
            console.error('Failed to remove favorite in header', err);
            this.popupService.showError('Không thể thực hiện bỏ thích lúc này.', 'Lỗi');
          }
        });
      },
      'Bỏ thích',
      'Hủy'
    );
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 20;
  }

  @HostListener('document:click', ['$event'])
  clickout(event: any) {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.isProfileOpen = false;
    }
  }

  toggleProfile() {
    this.isProfileOpen = !this.isProfileOpen;
  }

  onSearch() {
    const q = this.searchQuery ? this.searchQuery.trim() : '';
    if (q) {
      this.saveSearchHistory(q);
      this.showSearchHistory = false;
      this.router.navigate(['/home'], { queryParams: { q } });
    } else {
      this.router.navigate(['/home']);
    }
  }

  onSearchFocus() {
    this.loadSearchHistory();
    this.showSearchHistory = true;
  }

  onSearchBlur() {
    setTimeout(() => {
      this.showSearchHistory = false;
    }, 150);
  }

  get filteredSearchHistory(): string[] {
    if (!this.searchQuery || !this.searchQuery.trim()) {
      return this.searchHistory;
    }
    const q = this.searchQuery.trim().toLowerCase();
    return this.searchHistory.filter(item => item.toLowerCase().includes(q));
  }

  loadSearchHistory() {
    try {
      const saved = localStorage.getItem('ezmovie_search_history');
      this.searchHistory = saved ? JSON.parse(saved) : [];
    } catch (e) {
      this.searchHistory = [];
    }
  }

  saveSearchHistory(keyword: string) {
    if (!keyword || !keyword.trim()) return;
    const cleanKeyword = keyword.trim();
    this.loadSearchHistory();
    this.searchHistory = [
      cleanKeyword,
      ...this.searchHistory.filter(h => h.toLowerCase() !== cleanKeyword.toLowerCase())
    ].slice(0, 8);
    try {
      localStorage.setItem('ezmovie_search_history', JSON.stringify(this.searchHistory));
    } catch(e) {}
  }

  deleteSearchHistoryItem(event: Event, item: string) {
    event.stopPropagation();
    event.preventDefault();
    this.searchHistory = this.searchHistory.filter(h => h !== item);
    try {
      localStorage.setItem('ezmovie_search_history', JSON.stringify(this.searchHistory));
    } catch(e) {}
  }

  clearAllSearchHistory(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.searchHistory = [];
    try {
      localStorage.removeItem('ezmovie_search_history');
    } catch(e) {}
  }

  selectSearchHistoryItem(event: Event, item: string) {
    event.stopPropagation();
    event.preventDefault();
    this.searchQuery = item;
    this.showSearchHistory = false;
    this.onSearch();
  }

  openChangePassword() {
    this.isProfileOpen = false;
    this.changePasswordService.show();
  }

  openUpdateProfile() {
    this.isProfileOpen = false;
    this.updateProfileService.show();
  }

  logout() {
    this.popupService.showConfirm(
      'Bạn có chắc chắn muốn đăng xuất khỏi EZMOVIE?',
      'Xác nhận Đăng xuất',
      () => {
        this.isProfileOpen = false;
        this.loadingService.show();

        // Simulate 1 second delay
        setTimeout(() => {
          this.authService.logout();
          this.loadingService.hide();
          // this.router.navigate(['/login']);
        }, 1000);
      },
      'Đăng xuất',
      'Hủy'
    );
  }

  deleteWatchHistoryItem(event: Event, slug: string) {
    event.stopPropagation();
    this.popupService.showConfirm(
      'Bạn có chắc muốn xóa phim này khỏi lịch sử xem?',
      'Xóa Lịch Sử Xem',
      () => {
        this.loadingService.show();
        this.movieService.deleteWatchHistoryItem(slug).subscribe({
          next: () => {
            this.loadingService.hide();
            this.popupService.showSuccess('Đã xóa khỏi lịch sử xem!', 'Thành công');
          },
          error: (err) => {
            this.loadingService.hide();
            console.error('Failed to delete history item', err);
            this.popupService.showError('Không thể xóa lúc này.', 'Lỗi');
          }
        });
      },
      'Xóa',
      'Hủy'
    );
  }

  clearAllWatchHistory(event: Event) {
    event.stopPropagation();
    this.popupService.showConfirm(
      'Bạn có chắc muốn xóa TOÀN BỘ lịch sử xem phim?',
      'Xóa Tất Cả Lịch Sử',
      () => {
        this.loadingService.show();
        this.movieService.clearWatchHistory().subscribe({
          next: () => {
            this.loadingService.hide();
            this.popupService.showSuccess('Đã xóa toàn bộ lịch sử xem!', 'Thành công');
          },
          error: (err) => {
            this.loadingService.hide();
            console.error('Failed to clear watch history', err);
            this.popupService.showError('Không thể xóa toàn bộ lịch sử lúc này.', 'Lỗi');
          }
        });
      },
      'Xóa tất cả',
      'Hủy'
    );
  }

  getAvatarUrl(avatar: string | undefined): string {
    if (!avatar) return '/assets/images/default-avatar.png';
    if (avatar.startsWith('http')) return avatar;
    return environment.apiUrl + avatar;
  }

  handleAvatarError(event: any) {
    event.target.src = '/assets/images/default-avatar.png';
  }

  isMoviesActive(): boolean {
    return !this.isTvActive();
  }

  isTvActive(): boolean {
    return this.router.url.split('?')[0].startsWith('/tv');
  }
}
