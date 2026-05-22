import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { InputComponent } from './components/input/input.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ChangePasswordComponent } from './pages/change-password/change-password.component';
import { HomeComponent } from './pages/home/home.component';
import { LoadingComponent } from './components/loading/loading.component';
import { PopupComponent } from './components/popup/popup.component';
import { VerifyOtpComponent } from './components/verify-otp/verify-otp.component';
import { HeaderComponent } from './components/header/header.component';
import { UpdateProfileModalComponent } from './components/update-profile-modal/update-profile-modal.component';
import { SafePipe } from './pipes/safe.pipe';
import { MovieDetailComponent } from './pages/movie-detail/movie-detail.component';
import { TvComponent } from './pages/tv/tv.component';
import { MusicComponent } from './pages/music/music.component';
import { CartoonComponent } from './pages/cartoon/cartoon.component';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgrokInterceptor } from './ngrok.interceptor';
import { AuthInterceptor } from './interceptors/auth.interceptor';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    SignupComponent,
    InputComponent,
    ForgotPasswordComponent,
    ChangePasswordComponent,
    HomeComponent,
    LoadingComponent,
    PopupComponent,
    VerifyOtpComponent,
    HeaderComponent,
    UpdateProfileModalComponent,
    SafePipe,
    MovieDetailComponent,
    TvComponent,
    MusicComponent,
    CartoonComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: NgrokInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
