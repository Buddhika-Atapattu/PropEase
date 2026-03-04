import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BanksAccountItemComponent } from './banks-account-item.component';

describe('BanksAccountItemComponent', () => {
  let component: BanksAccountItemComponent;
  let fixture: ComponentFixture<BanksAccountItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BanksAccountItemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BanksAccountItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
