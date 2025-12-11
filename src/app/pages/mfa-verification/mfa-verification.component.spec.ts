import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MfaVerificationComponent } from './mfa-verification.component';

describe('MfaVerificationComponent', () => {
  let component: MfaVerificationComponent;
  let fixture: ComponentFixture<MfaVerificationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MfaVerificationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MfaVerificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
