import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileOpener } from './file-opener';

describe('FileOpener', () => {
  let component: FileOpener;
  let fixture: ComponentFixture<FileOpener>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileOpener]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileOpener);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
