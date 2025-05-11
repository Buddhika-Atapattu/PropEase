import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CameraBoxComponent } from './camera-box.component';

describe('CameraBoxComponent', () => {
  let component: CameraBoxComponent;
  let fixture: ComponentFixture<CameraBoxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CameraBoxComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CameraBoxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
