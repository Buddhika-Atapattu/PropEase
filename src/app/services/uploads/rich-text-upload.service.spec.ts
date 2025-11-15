import {TestBed} from '@angular/core/testing';

import {RichTextUploadService} from './rich-text-upload.service.ts';

describe('RichTextUploadServiceTs', () => {
  let service: RichTextUploadService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RichTextUploadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
