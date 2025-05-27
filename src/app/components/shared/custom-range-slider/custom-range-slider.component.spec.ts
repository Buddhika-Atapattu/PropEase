import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomRangeSliderComponent } from './custom-range-slider.component';

describe('CustomRangeSliderComponent', () => {
  let component: CustomRangeSliderComponent;
  let fixture: ComponentFixture<CustomRangeSliderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomRangeSliderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomRangeSliderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
