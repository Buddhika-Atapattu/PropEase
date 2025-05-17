import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserCreatinonManagementComponent } from './user-creatinon-management.component';

describe('UserCreatinonManagementComponent', () => {
  let component: UserCreatinonManagementComponent;
  let fixture: ComponentFixture<UserCreatinonManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserCreatinonManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserCreatinonManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
