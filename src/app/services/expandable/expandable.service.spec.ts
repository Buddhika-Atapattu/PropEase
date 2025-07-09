import { TestBed } from '@angular/core/testing';

import { ExpandableService } from './expandable.service';

describe('ExpandableService', () => {
  let service: ExpandableService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExpandableService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
