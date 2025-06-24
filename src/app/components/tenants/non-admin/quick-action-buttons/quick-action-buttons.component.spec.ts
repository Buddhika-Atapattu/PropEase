import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuickActionButtonsComponent } from './quick-action-buttons.component';

describe('QuickActionButtonsComponent', () => {
  let component: QuickActionButtonsComponent;
  let fixture: ComponentFixture<QuickActionButtonsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuickActionButtonsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuickActionButtonsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
