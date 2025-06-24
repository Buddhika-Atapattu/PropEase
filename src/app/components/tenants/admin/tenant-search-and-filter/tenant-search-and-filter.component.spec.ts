import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TenantSearchAndFilterComponent } from './tenant-search-and-filter.component';

describe('TenantSearchAndFilterComponent', () => {
  let component: TenantSearchAndFilterComponent;
  let fixture: ComponentFixture<TenantSearchAndFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantSearchAndFilterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TenantSearchAndFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
