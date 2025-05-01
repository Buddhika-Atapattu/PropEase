import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CheckInternetStatusComponent } from './check-internet-status.component';

describe('CheckInternetStatusComponent', () => {
  let component: CheckInternetStatusComponent;
  let fixture: ComponentFixture<CheckInternetStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckInternetStatusComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CheckInternetStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
