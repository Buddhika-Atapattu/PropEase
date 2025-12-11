import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionExpiryBannerComponent } from './session-expiry-banner.component';

describe('SessionExpiryBannerComponent', () => {
  let component: SessionExpiryBannerComponent;
  let fixture: ComponentFixture<SessionExpiryBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SessionExpiryBannerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SessionExpiryBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
