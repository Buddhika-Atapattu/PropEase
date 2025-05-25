import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PropertyFilterDialogComponent } from './property-filter-dialog.component';

describe('PropertyFilterDialogComponent', () => {
  let component: PropertyFilterDialogComponent;
  let fixture: ComponentFixture<PropertyFilterDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertyFilterDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PropertyFilterDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
