import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BanksAccountsComponent } from './banks-accounts.component';

describe('BanksAccountsComponent', () => {
  let component: BanksAccountsComponent;
  let fixture: ComponentFixture<BanksAccountsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BanksAccountsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BanksAccountsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
