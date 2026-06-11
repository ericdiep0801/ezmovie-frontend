import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TvShowsService, TvShowDto } from '../../services/tvshows.service';
import { LoadingService } from '../../services/loading.service';

@Component({
  selector: 'app-tvshows',
  templateUrl: './tvshows.component.html',
  styleUrls: ['./tvshows.component.css']
})
export class TvshowsComponent implements OnInit {
  shows: TvShowDto[] = [];
  activeShow: TvShowDto | null = null;
  isPlayingPreview: boolean = false;

  constructor(
    private tvShowsService: TvShowsService,
    private loadingService: LoadingService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTopShows();
  }

  loadTopShows(): void {
    this.loadingService.show();
    this.tvShowsService.getTopShows().subscribe({
      next: (res) => {
        if (res.status === 200 && res.data) {
          this.shows = res.data;
          if (this.shows.length > 0) {
            this.activeShow = this.shows[0];
          }
        }
        this.loadingService.hide();
      },
      error: (err) => {
        console.error('Error fetching tv shows', err);
        this.loadingService.hide();
      }
    });
  }

  selectShow(show: TvShowDto): void {
    this.activeShow = show;
    this.isPlayingPreview = false;
  }

  playPreview(): void {
    if (this.activeShow?.slug) {
      this.router.navigate(['/movie', this.activeShow.slug]);
    }
  }

  watchShow(show: TvShowDto): void {
    if (show.slug) {
      this.router.navigate(['/movie', show.slug]);
    }
  }
}
