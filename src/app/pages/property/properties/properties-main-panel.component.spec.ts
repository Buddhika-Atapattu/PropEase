import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PropertiesMainPanelComponent } from './properties-main-panel.component';

describe('PropertiesMainPanelComponent', () => {
  let component: PropertiesMainPanelComponent;
  let fixture: ComponentFixture<PropertiesMainPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertiesMainPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PropertiesMainPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
