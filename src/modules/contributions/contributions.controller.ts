import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import type { JwtRequestUser } from '@modules/auth/types/jwt-request-user';
import { ContributionsService } from './contributions.service';
import {
  OpenEvaluationDto,
  SubmitRatingDto,
} from './dto/contribution-evaluation.dto';

@ApiTags('Contributions')
@ApiBearerAuth('JWT')
@Controller('contributions')
@UseGuards(JwtAuthGuard)
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Post('groups/:groupId/open-evaluation')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Open peer evaluation round (leader only)' })
  @ApiResponse({ status: 201, description: 'Round created' })
  openEvaluation(
    @Req() req: Request,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: OpenEvaluationDto,
  ) {
    const user = req.user as JwtRequestUser;
    return this.contributionsService.openEvaluation(
      groupId,
      user.id,
      dto.due_date,
    );
  }

  @Patch('groups/:groupId/rounds/:roundStartedAt/close')
  @ApiOperation({ summary: 'Close evaluation round (leader only)' })
  closeEvaluation(
    @Req() req: Request,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('roundStartedAt') roundStartedAtParam: string,
  ) {
    const user = req.user as JwtRequestUser;
    const roundStartedAt =
      this.contributionsService.parseRoundStartedAt(roundStartedAtParam);
    return this.contributionsService.closeEvaluation(
      groupId,
      user.id,
      roundStartedAt,
    );
  }

  @Get('groups/:groupId/rounds')
  @ApiOperation({ summary: 'List evaluation rounds for a group' })
  listRounds(
    @Req() req: Request,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    const user = req.user as JwtRequestUser;
    return this.contributionsService.listRounds(groupId, user.id);
  }

  @Get('groups/:groupId/rounds/:roundStartedAt/my-ratings')
  @ApiOperation({ summary: 'Get current user ratings to submit for a round' })
  myRatings(
    @Req() req: Request,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('roundStartedAt') roundStartedAtParam: string,
  ) {
    const user = req.user as JwtRequestUser;
    const roundStartedAt =
      this.contributionsService.parseRoundStartedAt(roundStartedAtParam);
    return this.contributionsService.getMyRatingsForRound(
      groupId,
      roundStartedAt,
      user.id,
    );
  }

  @Put('groups/:groupId/rounds/:roundStartedAt/ratings/:rateeId')
  @ApiOperation({ summary: 'Submit or update a peer rating' })
  submitRating(
    @Req() req: Request,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('roundStartedAt') roundStartedAtParam: string,
    @Param('rateeId', ParseUUIDPipe) rateeId: string,
    @Body() dto: SubmitRatingDto,
  ) {
    const user = req.user as JwtRequestUser;
    const roundStartedAt =
      this.contributionsService.parseRoundStartedAt(roundStartedAtParam);
    return this.contributionsService.submitRating(
      groupId,
      roundStartedAt,
      user.id,
      rateeId,
      dto.score,
    );
  }

  @Get('groups/:groupId/rounds/:roundStartedAt/results')
  @ApiOperation({
    summary: 'Aggregated results (after leader closes the round)',
  })
  results(
    @Req() req: Request,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('roundStartedAt') roundStartedAtParam: string,
  ) {
    const user = req.user as JwtRequestUser;
    const roundStartedAt =
      this.contributionsService.parseRoundStartedAt(roundStartedAtParam);
    return this.contributionsService.getAggregatedResults(
      groupId,
      roundStartedAt,
      user.id,
    );
  }
}
