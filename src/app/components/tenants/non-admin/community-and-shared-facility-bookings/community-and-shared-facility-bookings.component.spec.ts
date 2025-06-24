import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityAndSharedFacilityBookingsComponent } from './community-and-shared-facility-bookings.component';

describe('CommunityAndSharedFacilityBookingsComponent', () => {
  let component: CommunityAndSharedFacilityBookingsComponent;
  let fixture: ComponentFixture<CommunityAndSharedFacilityBookingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityAndSharedFacilityBookingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommunityAndSharedFacilityBookingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
