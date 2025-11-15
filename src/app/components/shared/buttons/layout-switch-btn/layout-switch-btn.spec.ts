import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LayoutSwitchBtn } from './layout-switch-btn';

describe('LayoutSwitchBtn', () => {
  let component: LayoutSwitchBtn;
  let fixture: ComponentFixture<LayoutSwitchBtn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutSwitchBtn]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LayoutSwitchBtn);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
