import { TestBed } from '@angular/core/testing';

import { TrafficMonitorService } from './traffic-monitor.service';

describe('TrafficMonitorService', () => {
  let service: TrafficMonitorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TrafficMonitorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
