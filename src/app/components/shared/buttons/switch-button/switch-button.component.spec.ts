import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SwitchButton } from './switch-button.component';

describe('SwitchButton', () => {
  let component: SwitchButton;
  let fixture: ComponentFixture<SwitchButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwitchButton]
    })
      .compileComponents();

    fixture = TestBed.createComponent(SwitchButton);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
