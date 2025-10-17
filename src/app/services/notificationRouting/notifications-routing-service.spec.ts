import {TestBed} from '@angular/core/testing';

import {NoticationsRoutingService} from './notifications-routing-service';

describe('NoticationsRoutingService', () => {
  let service: NoticationsRoutingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NoticationsRoutingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
