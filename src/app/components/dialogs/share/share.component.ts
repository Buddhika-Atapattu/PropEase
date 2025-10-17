import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  AfterViewInit,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
  MatDialogModule,
} from '@angular/material/dialog';
import {isPlatformBrowser, CommonModule, AsyncPipe} from '@angular/common';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';
import {Subscription} from 'rxjs';
import {
  BackEndPropertyData,
  MSG,
  PropertyService,
} from '../../../services/property/property.service';
import {NotificationDialogComponent} from '../notification/notification.component';

@Component({
  selector: 'app-share',
  standalone: true,
  imports: [CommonModule, NotificationDialogComponent],
  templateUrl: './share.component.html',
  styleUrl: './share.component.scss',
})
export class ShareComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(NotificationDialogComponent, {static: true})
  notification!: NotificationDialogComponent;
  // Dialog data
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected property: BackEndPropertyData | null = null;
  protected link: string = '';
  protected isCopied: boolean = false;
  protected readonly socialMediaLinks = [
    {
      link: 'https://www.facebook.com/sharer/sharer.php?u=',
      type: 'facebook',
      image: '/Images/System-images/social-media/facebook.png',
    },
    {
      link: 'https://twitter.com/intent/tweet?url=',
      type: 'twitter',
      image: '/Images/System-images/social-media/twitter.png',
    },
    {
      link: 'https://www.instagram.com/share?url=',
      type: 'instagram',
      image: '/Images/System-images/social-media/instagram.png',
    },
    {
      link: 'https://www.linkedin.com/shareArticle?url=',
      type: 'linkedin',
      image: '/Images/System-images/social-media/linkedin.png',
    },
    {
      link: 'https://web.whatsapp.com/send?text=',
      type: 'whatsapp',
      image: '/Images/System-images/social-media/WhatsApp.png',
    },
    {
      link: 'https://telegram.me/share/url?url=',
      type: 'telegram',
      image: '/Images/System-images/social-media/telegram.png',
    },
  ];

  constructor (
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(MAT_DIALOG_DATA)
    public data: any = {},
    public dialogRef: MatDialogRef<ShareComponent>,
    private cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
    if(this.data.property) {
      this.property = this.data.property;
      this.link = `https://www.google.com/maps/place/${this.property?.location?.lat},${this.property?.location?.lng}`;
    }
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    // Force redraw after DOM
  }

  ngOnDestroy(): void {}

  protected copyToClipboard(inputElement: HTMLInputElement): void {
    console.log('Clciked');
    inputElement.select();
    inputElement.setSelectionRange(0, 99999); // For mobile
    navigator.clipboard.writeText(inputElement.value).then(() => {
      console.log('Link copied to clipboard!');
    });
    this.isCopied = true;
    setTimeout(() => {
      this.isCopied = false;
    }, 2000);
  }

  protected shareSocialMedia(type: string): void {
    const propertyUrl = `http://localhost:4200/dashboard/property-view/${this.property?.id}`; // update accordingly

    const text = `🏠 Check out this property listing!
📍 Address: ${this.property?.address?.houseNumber}, ${this.property?.address?.street}, ${this.property?.address?.city}, ${this.property?.address?.stateOrProvince}, ${this.property?.address?.country}, ${this.property?.address?.postcode}
📷 Image: ${this.property?.images?.[0]?.imageURL}
📑 Listing Type: ${this.property?.listing}
📈 Price: ${this.property?.price} ${this.property?.currency}
#PropertyFor${this.property?.listing} #PropEase`;

    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(propertyUrl);
    let fullLink = '';

    switch(type.toLowerCase()) {
      case 'facebook':
        fullLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'twitter':
        fullLink = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'linkedin':
        fullLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case 'whatsapp':
        fullLink = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
        break;
      case 'telegram':
        fullLink = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        break;
      case 'instagram':
        if(this.notification) {
          this.notification.notification(
            'warning',
            'Instagram does not support direct post sharing via links. Please copy the content manually.'
          );
        }
        return;
      default:
        console.warn(`Unsupported social media type: ${type}`);
        return;
    }

    window.open(fullLink, '_blank');
  }

  protected pannelClose() {
    this.dialogRef.close();
  }
}
