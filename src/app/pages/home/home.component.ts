import { Component, OnInit, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MovieService } from '../../services/movie.service';
import { LoadingService } from '../../services/loading.service';
import { PopupService } from '../../services/popup.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  public movies: any[] = [];
  public featuredMovie: any = null;
  public searchKeyword: string = '';
  public currentType: string = ''; // 'favorites' or 'history' or ''
  public page: number = 1;
  public totalPages: number = 1;
  public visiblePages: number[] = [];
  public pageSize: number = 100;
  public favoriteMovieSlugs: Set<string> = new Set<string>();
  public isPageSizeDropdownOpen: boolean = false;
  public pageSizeOptions: number[] = [24, 50, 100, 150, 200];

  public categories = ['Tất cả', 'Hoạt Hình', 'Hành Động', 'Cổ Trang', 'Chiến Tranh', 'Viễn Tưởng', 'Hình Sự', 'Kinh Dị', 'Tình Cảm', 'Cổ Tích', 'Hài Hước'];
  public inProgressMovies: any[] = [];
  public watchedMovies: any[] = [];
  public recommendedMovies: any[] = [];
  public recommendedGenreName: string = '';

  constructor(
    private movieService: MovieService,
    private route: ActivatedRoute,
    private router: Router,
    private loadingService: LoadingService,
    private popupService: PopupService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadFavoriteSlugs();

    // Listen for query parameters (q: search, type: favorites/history/catalog, page, limit)
    this.route.queryParams.subscribe(params => {
      const keyword = params['q'];
      const type = params['type'];
      const pageParam = params['page'] ? parseInt(params['page'], 10) : 1;
      const limitParam = params['limit'] ? parseInt(params['limit'], 10) : 100;

      this.page = pageParam;
      this.pageSize = limitParam;

      if (type === 'favorites') {
        this.currentType = 'favorites';
        this.searchKeyword = '';
        this.loadFavorites();
      } else if (type === 'history') {
        this.currentType = 'history';
        this.searchKeyword = '';
        this.loadWatchHistory();
      } else if (type === 'catalog') {
        this.currentType = 'catalog';
        this.searchKeyword = '';
        this.loadNewMovies(this.page);
      } else if (keyword) {
        this.currentType = '';
        this.searchKeyword = keyword;
        this.searchMovies(keyword, this.page);
      } else {
        this.currentType = '';
        this.searchKeyword = '';
        this.loadNewMovies(this.page);
        this.loadHomeSections();
      }
    });

    // Reactive subscriptions to refresh list in real-time
    this.movieService.favoriteUpdated$.subscribe(() => {
      if (this.currentType === 'favorites') {
        this.loadFavorites();
      }
      this.loadFavoriteSlugs();
    });

    this.movieService.historyUpdated$.subscribe(() => {
      if (this.currentType === 'history') {
        this.loadWatchHistory();
      }
      this.loadHomeSections();
    });
  }

  loadNewMovies(page: number = 1): void {
    this.loadingService.show();
    this.movieService.getMovies(page, this.pageSize).subscribe({
      next: (res) => {
        if (res.status === 200 && res.items) {
          this.movies = res.items;
          this.page = res.pagination?.currentPage || 1;
          this.totalPages = res.pagination?.totalPages || 1;
          this.updateVisiblePages();
          
          if (this.movies.length > 0) {
            if (this.currentType === 'catalog') {
              this.featuredMovie = null;
            } else {
              const first = this.movies[0];
              this.featuredMovie = {
                title: first.name,
                description: `${first.origin_name} (${first.year}) - Phim mới cập nhật chất lượng cực cao.`,
                imageUrl: first.poster_url || first.thumb_url,
                slug: first.slug
              };
            }
          }
        }
        this.loadingService.hide();
      },
      error: (err) => {
        console.error('Failed to load movies', err);
        this.loadingService.hide();
      }
    });
  }

  searchMovies(keyword: string, page: number = 1): void {
    this.loadingService.show();
    this.movieService.searchMovies(keyword, page, this.pageSize).subscribe({
      next: (res) => {
        if (res.status === 200 && res.items) {
          this.movies = res.items;
          this.page = res.pagination?.currentPage || 1;
          this.totalPages = res.pagination?.totalPages || 1;
          this.updateVisiblePages();
          
          if (this.movies.length > 0) {
            const first = this.movies[0];
            this.featuredMovie = {
              title: first.name,
              description: `Kết quả tìm kiếm cho từ khóa "${keyword}". Phim ${first.origin_name} (${first.year}).`,
              imageUrl: first.poster_url || first.thumb_url,
              slug: first.slug
            };
          } else {
            this.featuredMovie = {
              title: `TÌM KIẾM: ${keyword.toUpperCase()}`,
              description: `Không tìm thấy kết quả phù hợp cho từ khóa "${keyword}". Hãy thử tìm kiếm từ khóa khác!`,
              imageUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=1925&ixlib=rb-4.0.3',
              slug: null
            };
          }
        }
        this.loadingService.hide();
      },
      error: (err) => {
        console.error('Failed to search movies', err);
        this.loadingService.hide();
      }
    });
  }

  loadFavorites(): void {
    this.loadingService.show();
    this.movieService.listFavorites().subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          // Map favorite entity to movie structure
          this.movies = res.data.map((fav: any) => ({
            name: fav.movieName,
            slug: fav.movieSlug,
            thumb_url: fav.moviePoster,
            poster_url: fav.moviePoster,
            type: fav.movieType
          }));

          this.featuredMovie = {
            title: 'PHIM YÊU THÍCH',
            description: 'Danh sách những bộ phim bạn đã lưu để xem lại. Bấm chọn phim để thưởng thức ngay!',
            imageUrl: this.movies.length > 0 ? this.movies[0].thumb_url : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=1925&ixlib=rb-4.0.3',
            slug: null
          };
        }
        this.loadingService.hide();
      },
      error: (err) => {
        console.error('Failed to load favorites', err);
        this.loadingService.hide();
      }
    });
  }

  loadWatchHistory(): void {
    this.loadingService.show();
    this.movieService.listWatchHistory().subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          // Map history entity to movie structure
          this.movies = res.data.map((h: any) => ({
            name: h.movieName,
            slug: h.movieSlug,
            thumb_url: h.moviePoster,
            poster_url: h.moviePoster,
            episode_current: h.episodeName // Display last watched episode name
          }));

          this.featuredMovie = {
            title: 'LỊCH SỬ XEM PHIM',
            description: 'Xem lại các bộ phim và tập phim bạn đã xem gần đây. Tự động lưu trữ lịch sử phát phim của bạn.',
            imageUrl: this.movies.length > 0 ? this.movies[0].thumb_url : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=1925&ixlib=rb-4.0.3',
            slug: null
          };
        }
        this.loadingService.hide();
      },
      error: (err) => {
        console.error('Failed to load watch history', err);
        this.loadingService.hide();
      }
    });
  }

  clearHistory(): void {
    this.popupService.showConfirm(
      'Bạn có chắc chắn muốn xóa toàn bộ lịch sử xem phim của mình?',
      'Xóa lịch sử xem',
      () => {
        this.loadingService.show();
        this.movieService.clearWatchHistory().subscribe({
          next: (res) => {
            if (res.status === 200) {
              this.movies = [];
              this.popupService.showSuccess('Đã xóa toàn bộ lịch sử xem phim!', 'Xóa lịch sử');
            }
            this.loadingService.hide();
          },
          error: (err) => {
            console.error('Failed to clear history', err);
            this.loadingService.hide();
          }
        });
      }
    );
  }

  viewMovie(slug: string): void {
    if (slug) {
      this.router.navigate(['/movie', slug]);
    }
  }

  onCategoryClick(cat: string): void {
    if (cat === 'Tất cả') {
      this.router.navigate(['/home']);
    } else {
      this.router.navigate(['/home'], { queryParams: { q: cat } });
    }
  }

  // Calculate visible page buttons in pagination
  updateVisiblePages() {
    const pages: number[] = [];
    const start = Math.max(1, this.page - 2);
    const end = Math.min(this.totalPages, this.page + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    this.visiblePages = pages;
  }

  goToPage(p: number): void {
    if (p >= 1 && p <= this.totalPages) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { page: p },
        queryParamsHandling: 'merge'
      });
      // Scroll smoothly back to top of content
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  }

  onPageSizeChange(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: 1, limit: this.pageSize },
      queryParamsHandling: 'merge'
    });
  }

  togglePageSizeDropdown(event: Event): void {
    event.stopPropagation();
    this.isPageSizeDropdownOpen = !this.isPageSizeDropdownOpen;
  }

  selectPageSize(size: number, event: Event): void {
    event.stopPropagation();
    this.pageSize = size;
    this.isPageSizeDropdownOpen = false;
    this.onPageSizeChange();
  }

  @HostListener('document:click')
  closeDropdowns(): void {
    this.isPageSizeDropdownOpen = false;
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.goToPage(this.page + 1);
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.goToPage(this.page - 1);
    }
  }

  loadFavoriteSlugs(): void {
    if (this.authService.isLoggedIn()) {
      this.movieService.listFavorites().subscribe({
        next: (res) => {
          if (res.status === 200 && res.data) {
            this.favoriteMovieSlugs = new Set<string>(res.data.map((fav: any) => fav.movieSlug));
          }
        },
        error: (err) => {
          console.error('Failed to load favorite slugs', err);
        }
      });
    } else {
      this.favoriteMovieSlugs.clear();
    }
  }

  isFavorite(slug: string): boolean {
    return this.favoriteMovieSlugs.has(slug);
  }

  toggleFavoriteOnCard(event: Event, movie: any): void {
    event.stopPropagation();
    event.preventDefault();
    if (!this.authService.isLoggedIn()) {
      this.popupService.showError('Vui lòng đăng nhập để lưu phim yêu thích!', 'Đăng Nhập Yêu Cầu');
      return;
    }

    const slug = movie.slug;
    const isFav = this.isFavorite(slug);

    if (isFav) {
      this.movieService.toggleFavorite({ movieSlug: slug }).subscribe({
        next: (res) => {
          if (res.status === 200) {
            this.favoriteMovieSlugs.delete(slug);
            this.movieService.triggerFavoriteUpdate(); // Sync with header list!
            this.popupService.showSuccess('Đã bỏ yêu thích phim!', 'Thành công');
          }
        },
        error: (err) => {
          this.popupService.showError('Không thể thực hiện lúc này.', 'Lỗi');
        }
      });
    } else {
      this.movieService.toggleFavorite({
        movieSlug: slug,
        movieName: movie.name,
        moviePoster: movie.thumb_url || movie.poster_url,
        movieType: movie.type || (movie.episode_current ? 'series' : 'single')
      }).subscribe({
        next: (res) => {
          if (res.status === 200) {
            this.favoriteMovieSlugs.add(slug);
            this.movieService.triggerFavoriteUpdate(); // Sync with header list!
            this.popupService.showSuccess('Đã thêm vào danh sách yêu thích!', 'Thành công');
          }
        },
        error: (err) => {
          this.popupService.showError('Không thể thực hiện lúc này.', 'Lỗi');
        }
      });
    }
  }

  loadHomeSections(): void {
    if (this.authService.isLoggedIn()) {
      this.movieService.listWatchHistory().subscribe({
        next: (res) => {
          if (res.status === 200 && res.data) {
            const historyItems = res.data;
            const allProgress = JSON.parse(localStorage.getItem('movie_progress') || '{}');
            
            const inProgressMovies: any[] = [];
            const watchedMovies: any[] = [];
            
            for (const item of historyItems) {
              const prog = allProgress[item.movieSlug];
              const percent = prog ? prog.progressPercent : 0;
              const movieObj = {
                name: item.movieName,
                slug: item.movieSlug,
                thumb_url: item.moviePoster,
                poster_url: item.moviePoster,
                episode_current: item.episodeName,
                episode_slug: item.episodeSlug,
                progressPercent: Math.round(percent)
              };
              
              if (percent >= 90) {
                watchedMovies.push(movieObj);
              } else {
                inProgressMovies.push(movieObj);
              }
            }
            
            this.inProgressMovies = inProgressMovies.slice(0, 10);
            this.watchedMovies = watchedMovies;
            
            if (historyItems.length > 0) {
              this.loadRecommendedMovies(historyItems[0].movieSlug);
            } else {
              this.loadDefaultRecommendations();
            }
          }
        },
        error: (err) => {
          console.error('Failed to load watch history sections', err);
          this.loadDefaultRecommendations();
        }
      });
    } else {
      this.inProgressMovies = [];
      this.watchedMovies = [];
      this.loadDefaultRecommendations();
    }
  }

  loadRecommendedMovies(latestMovieSlug: string): void {
    this.movieService.getMovieDetails(latestMovieSlug).subscribe({
      next: (res) => {
        if (res.status === 200 && res.data && res.data.movie) {
          const movieDetail = res.data.movie;
          const categories = movieDetail.category;
          if (categories && categories.length > 0) {
            let targetGenre = categories[0].name;
            for (const cat of categories) {
              if (this.categories.includes(cat.name)) {
                targetGenre = cat.name;
                break;
              }
            }
            this.recommendedGenreName = targetGenre;
            this.movieService.searchMovies(targetGenre, 1, 10).subscribe({
              next: (searchRes) => {
                if (searchRes.status === 200 && searchRes.items) {
                  this.recommendedMovies = searchRes.items
                    .filter((m: any) => m.slug !== latestMovieSlug)
                    .slice(0, 10);
                }
              }
            });
          } else {
            this.loadDefaultRecommendations();
          }
        } else {
          this.loadDefaultRecommendations();
        }
      },
      error: () => this.loadDefaultRecommendations()
    });
  }

  loadDefaultRecommendations(): void {
    this.recommendedGenreName = 'Hành Động';
    this.movieService.searchMovies('Hành Động', 1, 10).subscribe({
      next: (res) => {
        if (res.status === 200 && res.items) {
          this.recommendedMovies = res.items.slice(0, 10);
        }
      }
    });
  }
}
