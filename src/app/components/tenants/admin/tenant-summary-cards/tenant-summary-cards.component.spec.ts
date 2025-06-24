import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TenantSummaryCardsComponent } from './tenant-summary-cards.component';

describe('TenantSummaryCardsComponent', () => {
  let component: TenantSummaryCardsComponent;
  let fixture: ComponentFixture<TenantSummaryCardsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantSummaryCardsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TenantSummaryCardsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
