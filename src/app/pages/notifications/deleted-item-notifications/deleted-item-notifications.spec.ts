import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeletedItemNotifications } from './deleted-item-notifications';

describe('DeletedItemNotifications', () => {
  let component: DeletedItemNotifications;
  let fixture: ComponentFixture<DeletedItemNotifications>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeletedItemNotifications]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeletedItemNotifications);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
