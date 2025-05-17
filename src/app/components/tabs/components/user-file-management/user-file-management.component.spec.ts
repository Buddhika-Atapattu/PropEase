import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserFileManagementComponent } from './user-file-management.component';

describe('UserFileManagementComponent', () => {
  let component: UserFileManagementComponent;
  let fixture: ComponentFixture<UserFileManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserFileManagementComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UserFileManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
