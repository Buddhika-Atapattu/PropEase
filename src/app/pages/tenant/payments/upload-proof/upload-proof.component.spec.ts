import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadProofComponent } from './upload-proof.component';

describe('UploadProofComponent', () => {
  let component: UploadProofComponent;
  let fixture: ComponentFixture<UploadProofComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadProofComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadProofComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
