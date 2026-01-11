import { TestBed } from '@angular/core/testing';

import { FileMetadataService } from './file-metadata.service';

describe('FileMetadataService', () => {
  let service: FileMetadataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FileMetadataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
