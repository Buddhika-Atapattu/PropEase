import { TestBed } from '@angular/core/testing';

import { SessionExpiryUiService } from './session-expiry-ui.service';

describe('SessionExpiryUiService', () => {
  let service: SessionExpiryUiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionExpiryUiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
