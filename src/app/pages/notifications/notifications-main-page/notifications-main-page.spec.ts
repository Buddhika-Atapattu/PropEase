import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationsMainPage } from './notifications-main-page';

describe('NotificationsMainPage', () => {
  let component: NotificationsMainPage;
  let fixture: ComponentFixture<NotificationsMainPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsMainPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationsMainPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
