import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MobileSupportFileUpload } from './mobile-support-file-upload';

describe('MobileSupportFileUpload', () => {
  let component: MobileSupportFileUpload;
  let fixture: ComponentFixture<MobileSupportFileUpload>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileSupportFileUpload]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MobileSupportFileUpload);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
