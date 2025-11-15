import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StageIndicatorComponent } from './stage-indicator.component';

describe('StageIndicatorComponent', () => {
  let component: StageIndicatorComponent;
  let fixture: ComponentFixture<StageIndicatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StageIndicatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StageIndicatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
