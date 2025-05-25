import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PropertyViewCardComponent } from './property-view-card.component';

describe('PropertyViewCardComponent', () => {
  let component: PropertyViewCardComponent;
  let fixture: ComponentFixture<PropertyViewCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertyViewCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PropertyViewCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
