import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModeChangerComponent } from './mode-changer.component';

describe('ModeChangerComponent', () => {
  let component: ModeChangerComponent;
  let fixture: ComponentFixture<ModeChangerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModeChangerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModeChangerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
