import { TestBed } from '@angular/core/testing';

import { PageNavigatorService } from './page-navigator.service';

describe('PageNavigatorService', () => {
  let service: PageNavigatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PageNavigatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
