import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectedUserProfileComponent } from './selected-user-profile.component';

describe('SelectedUserProfileComponent', () => {
  let component: SelectedUserProfileComponent;
  let fixture: ComponentFixture<SelectedUserProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectedUserProfileComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectedUserProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
