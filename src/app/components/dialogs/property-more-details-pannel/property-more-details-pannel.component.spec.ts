import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PropertyMoreDetailsPannelComponent } from './property-more-details-pannel.component';

describe('PropertyMoreDetailsPannelComponent', () => {
  let component: PropertyMoreDetailsPannelComponent;
  let fixture: ComponentFixture<PropertyMoreDetailsPannelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertyMoreDetailsPannelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PropertyMoreDetailsPannelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
