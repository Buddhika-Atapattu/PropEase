import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccessabilitiesComponent } from './accessabilities.component';

describe('AccessabilitiesComponent', () => {
  let component: AccessabilitiesComponent;
  let fixture: ComponentFixture<AccessabilitiesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccessabilitiesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccessabilitiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
