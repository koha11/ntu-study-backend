import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ContributionsService } from './contributions.service';

@Controller('contributions')
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Post('groups/:groupId/ratings')
  submitRating(@Param('groupId') _groupId: string, @Body() _ratingDto: any) {
    // TODO: Submit rating
    return {};
  }

  @Get('groups/:groupId/ratings')
  findGroupRatings(@Param('groupId') _groupId: string) {
    // TODO: Get group ratings
    return [];
  }

  @Post('groups/:groupId/open-evaluation')
  openEvaluation(@Param('groupId') _groupId: string, @Body() _evalData: any) {
    // TODO: Open evaluation
    return {};
  }

  @Post('groups/:groupId/close-evaluation')
  closeEvaluation(@Param('groupId') _groupId: string) {
    // TODO: Close evaluation
    return {};
  }
}
