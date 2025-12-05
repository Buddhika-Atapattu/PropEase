import { TestBed } from '@angular/core/testing';

import { HeaderContextService } from './header-context.service';

describe('HeaderContextService', () => {
  let service: HeaderContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HeaderContextService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
