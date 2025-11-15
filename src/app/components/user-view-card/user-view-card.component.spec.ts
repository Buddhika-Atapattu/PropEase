import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserViewCardComponent } from './user-view-card.component';

describe('UserViewCardComponent', () => {
  let component: UserViewCardComponent;
  let fixture: ComponentFixture<UserViewCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserViewCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserViewCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
