import {TestBed} from '@angular/core/testing';

import {RichTextUploadServiceTs} from './rich-text-upload.service.ts';

describe('RichTextUploadServiceTs', () => {
  let service: RichTextUploadServiceTs;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RichTextUploadServiceTs);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
