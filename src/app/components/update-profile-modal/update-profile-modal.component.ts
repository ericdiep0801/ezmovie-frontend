import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UpdateProfileService } from '../../services/update-profile.service';
import { LoadingService } from '../../services/loading.service';
import { PopupService } from '../../services/popup.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-update-profile-modal',
  templateUrl: './update-profile-modal.component.html',
  styleUrls: ['./update-profile-modal.component.css']
})
export class UpdateProfileModalComponent implements OnInit {
  public profileForm: FormGroup;
  public isOpen: boolean = false;
  public selectedFile: File | null = null;
  public previewUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private updateProfileService: UpdateProfileService,
    private loadingService: LoadingService,
    private popupService: PopupService
  ) {
    this.profileForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  ngOnInit(): void {
    this.updateProfileService.show$.subscribe(val => {
      this.isOpen = val;
      if (val) {
        const user = this.authService.currentUserValue;
        if (user) {
          this.profileForm.patchValue({
            username: user.username
          });
          this.previewUrl = this.getAvatarUrl((user as any).avatar);
        }
      }
    });
  }

  getAvatarUrl(avatar: string | undefined): string {
    if (!avatar) return '/assets/images/default-avatar.png';
    if (avatar.startsWith('http') || avatar.startsWith('data:')) return avatar;
    return environment.apiUrl + avatar;
  }

  handleAvatarError(event: any) {
    event.target.src = '/assets/images/default-avatar.png';
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        this.popupService.showError('Please select an image file', 'Invalid File');
        return;
      }
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  close(): void {
    this.updateProfileService.hide();
    this.selectedFile = null;
    this.previewUrl = null;
  }

  onSubmit(): void {
    if (this.profileForm.valid) {
      this.loadingService.show();
      const formData = new FormData();
      formData.append('username', this.profileForm.get('username')?.value);
      if (this.selectedFile) {
        formData.append('avatar', this.selectedFile);
      }

      this.authService.updateProfile(formData).subscribe({
        next: (res) => {
          this.loadingService.hide();
          if (res.status === 200) {
            this.popupService.showSuccess('Profile updated successfully!', 'Success');
            this.close();
          } else {
            this.popupService.showError(res.message, 'Update Failed');
          }
        },
        error: (err) => {
          this.loadingService.hide();
          this.popupService.showError(err.error?.message || 'Something went wrong', 'Error');
        }
      });
    }
  }
}
