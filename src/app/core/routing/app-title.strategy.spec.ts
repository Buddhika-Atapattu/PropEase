import { TestBed } from '@angular/core/testing';

import { AppTitleStrategy } from './app-title.strategy';

describe('AppTitleStrategy', () => {
  let service: AppTitleStrategy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppTitleStrategy);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
