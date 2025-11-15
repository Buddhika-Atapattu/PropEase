import { TestBed } from '@angular/core/testing';

import { AttachmentDownloaderService } from './attachment-downloader.service';

describe('AttachmentDownloaderService', () => {
  let service: AttachmentDownloaderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AttachmentDownloaderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
