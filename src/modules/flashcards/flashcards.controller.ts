import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import type { JwtRequestUser } from '@modules/auth/types/jwt-request-user';
import { FlashcardsService } from './flashcards.service';
import {
  CreateFlashcardSetDto,
  CreateFlashcardDto,
  CompleteStudyDto,
  UpdateFlashcardSetDto,
  UpdateFlashcardDto,
} from './dto/flashcard.dto';
import {
  serializeFlashcardSetForApi,
  serializeFlashcardForApi,
  serializeStudyLogForApi,
} from './flashcard-response.mapper';

@ApiTags('Flashcards')
@ApiBearerAuth('JWT')
@Controller('flashcard-sets')
@UseGuards(JwtAuthGuard)
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new flashcard set' })
  @ApiResponse({ status: 201, description: 'Flashcard set created' })
  createSet(@Req() req: Request, @Body() createSetDto: CreateFlashcardSetDto) {
    const user = req.user as JwtRequestUser;
    return this.flashcardsService
      .createSet(user.id, createSetDto)
      .then((set) => serializeFlashcardSetForApi(set, { omitCards: true }));
  }

  @Get()
  @ApiOperation({ summary: "Get current user's flashcard sets" })
  @ApiResponse({ status: 200, description: 'Flashcard sets retrieved' })
  findUserSets(@Req() req: Request) {
    const user = req.user as JwtRequestUser;
    return this.flashcardsService
      .findUserSets(user.id)
      .then((sets) =>
        sets.map((s) => serializeFlashcardSetForApi(s, { omitCards: true })),
      );
  }

  @Post(':id/study/complete')
  @ApiOperation({ summary: 'Complete study session and record progress' })
  @ApiResponse({ status: 200, description: 'Study session completed' })
  completeStudy(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() studyDto: CompleteStudyDto,
  ) {
    const user = req.user as JwtRequestUser;
    return this.flashcardsService
      .completeStudy(user.id, id, studyDto)
      .then(serializeStudyLogForApi);
  }

  @Post(':id/study')
  @ApiOperation({ summary: 'Start study session for flashcard set' })
  @ApiResponse({ status: 200, description: 'Study session metadata' })
  startStudy(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtRequestUser;
    return this.flashcardsService.startStudy(user.id, id);
  }

  @Post(':id/cards')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add flashcard to set' })
  @ApiResponse({ status: 201, description: 'Flashcard added' })
  addFlashcard(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() createCardDto: CreateFlashcardDto,
  ) {
    const user = req.user as JwtRequestUser;
    return this.flashcardsService
      .addFlashcard(user.id, id, createCardDto)
      .then(serializeFlashcardForApi);
  }

  @Patch(':id/cards/:cardId')
  @ApiOperation({ summary: 'Update a flashcard' })
  @ApiResponse({ status: 200, description: 'Flashcard updated' })
  updateFlashcard(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('cardId') cardId: string,
    @Body() dto: UpdateFlashcardDto,
  ) {
    const user = req.user as JwtRequestUser;
    return this.flashcardsService
      .updateFlashcard(user.id, id, cardId, dto)
      .then(serializeFlashcardForApi);
  }

  @Delete(':id/cards/:cardId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a flashcard from a set' })
  @ApiResponse({ status: 204, description: 'Removed' })
  async removeFlashcard(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('cardId') cardId: string,
  ) {
    const user = req.user as JwtRequestUser;
    await this.flashcardsService.removeFlashcard(user.id, id, cardId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update flashcard set metadata' })
  @ApiResponse({ status: 200, description: 'Set updated' })
  updateSet(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateFlashcardSetDto,
  ) {
    const user = req.user as JwtRequestUser;
    return this.flashcardsService
      .updateSet(user.id, id, dto)
      .then((set) => serializeFlashcardSetForApi(set, { omitCards: true }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get flashcard set with cards' })
  @ApiResponse({ status: 200, description: 'Flashcard set found' })
  @ApiResponse({ status: 404, description: 'Set not found' })
  findSet(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtRequestUser;
    return this.flashcardsService
      .findSet(id, user.id)
      .then((set) => serializeFlashcardSetForApi(set));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a flashcard set' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async deleteSet(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtRequestUser;
    await this.flashcardsService.deleteSet(user.id, id);
  }
}
