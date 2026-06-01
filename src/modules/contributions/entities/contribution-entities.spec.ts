import { describe, it, expect } from 'vitest';
import { ContributionRating } from './contribution-rating.entity';

describe('ContributionRating Entity', () => {
  it('can be instantiated and properties assigned', () => {
    const entity = new ContributionRating();
    entity.group_id = 'group-1';
    entity.score = 8;
    entity.is_round_closed = false;
    expect(entity.score).toBe(8);
    expect(entity.is_round_closed).toBe(false);
  });
});
