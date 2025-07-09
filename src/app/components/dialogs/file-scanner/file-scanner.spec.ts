import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileScanner } from './file-scanner';

describe('FileScanner', () => {
  let component: FileScanner;
  let fixture: ComponentFixture<FileScanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileScanner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileScanner);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
