import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContributionRating } from './entities/contribution-rating.entity';

@Injectable()
export class ContributionsService {
  constructor(
    @InjectRepository(ContributionRating)
    private ratingsRepository: Repository<ContributionRating>,
  ) {}

  async submitRating(
    _ratingData: Partial<ContributionRating>,
  ): Promise<ContributionRating> {
    // TODO: Submit peer rating
    throw new Error('Not implemented');
  }

  async findGroupRatings(_groupId: string): Promise<ContributionRating[]> {
    // TODO: Find ratings for group (leader only, after deadline)
    return [];
  }

  async openEvaluation(_groupId: string, _dueDate: Date): Promise<any> {
    // TODO: Open contribution evaluation window
    return {};
  }

  async closeEvaluation(_groupId: string): Promise<any> {
    // TODO: Close evaluation and lock ratings
    return {};
  }
}
