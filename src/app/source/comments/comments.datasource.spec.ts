import {TestBed} from '@angular/core/testing';

import {CommentsDataSource} from './comments.datasource';

describe('CommentDatasource', () => {
  let service: CommentsDataSource;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CommentsDataSource);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
