import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BanksAccountUpdateComponent } from './banks-account-update.component';

describe('BanksAccountUpdateComponent', () => {
  let component: BanksAccountUpdateComponent;
  let fixture: ComponentFixture<BanksAccountUpdateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BanksAccountUpdateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BanksAccountUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
