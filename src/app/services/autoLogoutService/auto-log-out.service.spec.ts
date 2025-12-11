import { TestBed } from '@angular/core/testing';

import { AutoLogOutService } from './auto-log-out.service';

describe('AutoLogOutService', () => {
  let service: AutoLogOutService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AutoLogOutService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
