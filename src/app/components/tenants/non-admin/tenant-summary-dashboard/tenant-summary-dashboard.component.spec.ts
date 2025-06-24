import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TenantSummaryDashboardComponent } from './tenant-summary-dashboard.component';

describe('TenantSummaryDashboardComponent', () => {
  let component: TenantSummaryDashboardComponent;
  let fixture: ComponentFixture<TenantSummaryDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantSummaryDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TenantSummaryDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
