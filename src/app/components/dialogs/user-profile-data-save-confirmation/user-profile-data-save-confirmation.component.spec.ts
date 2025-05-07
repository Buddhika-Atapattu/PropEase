import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserProfileDataSaveConfirmationComponent } from './user-profile-data-save-confirmation.component';

describe('UserProfileDataSaveConfirmationComponent', () => {
  let component: UserProfileDataSaveConfirmationComponent;
  let fixture: ComponentFixture<UserProfileDataSaveConfirmationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserProfileDataSaveConfirmationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserProfileDataSaveConfirmationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
