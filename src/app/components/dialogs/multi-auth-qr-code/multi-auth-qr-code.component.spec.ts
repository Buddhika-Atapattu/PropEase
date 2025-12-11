import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiAuthQrCodeComponent } from './multi-auth-qr-code.component';

describe('MultiAuthQrCodeComponent', () => {
  let component: MultiAuthQrCodeComponent;
  let fixture: ComponentFixture<MultiAuthQrCodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiAuthQrCodeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MultiAuthQrCodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
