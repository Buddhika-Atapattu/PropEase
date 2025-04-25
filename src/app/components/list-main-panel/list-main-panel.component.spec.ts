import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListMainPanelComponent } from './list-main-panel.component';

describe('ListMainPanelComponent', () => {
  let component: ListMainPanelComponent;
  let fixture: ComponentFixture<ListMainPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListMainPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListMainPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
