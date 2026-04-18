import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FlashcardsService } from './flashcards.service';

@ApiTags('Flashcards')
@ApiBearerAuth('JWT')
@Controller('flashcard-sets')
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new flashcard set' })
  @ApiResponse({
    status: 201,
    description: 'Flashcard set created',
    schema: {
      example: {
        id: 'set-id-uuid',
        title: 'CS2040S Sorting Algorithms',
        card_count: 0,
        created_at: '2026-04-18T00:00:00Z',
      },
    },
  })
  createSet(@Body() _createSetDto: any) {
    // TODO: Create flashcard set
    return {};
  }

  @Get()
  @ApiOperation({ summary: "Get user's flashcard sets" })
  @ApiResponse({
    status: 200,
    description: 'Flashcard sets retrieved',
    schema: {
      example: [
        {
          id: 'set-id-uuid',
          title: 'CS2040S Sorting Algorithms',
          card_count: 15,
        },
      ],
    },
  })
  findUserSets() {
    // TODO: Get user's flashcard sets
    return [];
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get flashcard set with cards' })
  @ApiResponse({
    status: 200,
    description: 'Flashcard set found',
  })
  @ApiResponse({ status: 404, description: 'Set not found' })
  findSet(@Param('id') _id: string) {
    // TODO: Get flashcard set
    return {};
  }

  @Post(':id/cards')
  @ApiOperation({ summary: 'Add flashcard to set' })
  @ApiResponse({
    status: 201,
    description: 'Flashcard added',
  })
  @ApiResponse({ status: 404, description: 'Set not found' })
  addFlashcard(@Param('id') _id: string, @Body() _createCardDto: any) {
    // TODO: Add flashcard
    return {};
  }

  @Post(':id/study')
  @ApiOperation({ summary: 'Start study session for flashcard set' })
  @ApiResponse({
    status: 200,
    description: 'Study session started',
    schema: {
      example: {
        session_id: 'session-id-uuid',
        total_cards: 15,
        cards_to_review: 8,
      },
    },
  })
  startStudy(@Param('id') _id: string) {
    // TODO: Start study session
    return {};
  }

  @Post(':id/study/complete')
  @ApiOperation({ summary: 'Complete study session and record progress' })
  @ApiResponse({
    status: 200,
    description: 'Study session completed',
    schema: {
      example: {
        cards_mastered: 5,
        cards_learning: 3,
        study_duration_minutes: 15,
      },
    },
  })
  completeStudy(@Param('id') _id: string, @Body() _studyData: any) {
    // TODO: Complete study session
    return {};
  }
}
