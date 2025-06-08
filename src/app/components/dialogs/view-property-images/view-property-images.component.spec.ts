import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewPropertyImagesComponent } from './view-property-images.component';

describe('ViewPropertyImagesComponent', () => {
  let component: ViewPropertyImagesComponent;
  let fixture: ComponentFixture<ViewPropertyImagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewPropertyImagesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewPropertyImagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
