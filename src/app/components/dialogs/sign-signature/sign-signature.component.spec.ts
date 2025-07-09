import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SignSignature } from './sign-signature';

describe('SignSignature', () => {
  let component: SignSignature;
  let fixture: ComponentFixture<SignSignature>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignSignature]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SignSignature);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
