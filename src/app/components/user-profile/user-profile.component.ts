import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { WindowsRefService } from '../../../services/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import {
  MatCheckboxChange,
  MatCheckboxModule,
} from '@angular/material/checkbox';
import {
  AuthService,
  UserCredentials,
  NewUser,
  Address,
  Role,
} from '../../../services/auth/auth.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
  ],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss'], // Correct: `styleUrls` not `styleUrl`
})
export class UserProfileComponent implements OnInit, OnDestroy {
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  private isEditable: boolean = false;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
      console.log('Full path:', path);
    });
    console.log(this.authService.getLoggedUser);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
        console.log('MainPanel detected mode:', this.mode);
      });
    }
  }

  get isEditableForm(): boolean {
    return this.isEditable;
  }

  set isEditableForm(value: boolean) {
    this.isEditable = value;
  }

  get auth(): AuthService {
    return this.authService;
  }

  protected onEdit() {
    this.isEditable = true;
  }

  protected onSubmit() {}

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }
}
