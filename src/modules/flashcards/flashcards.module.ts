import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashcardsService } from './flashcards.service';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardSet } from './entities/flashcard-set.entity';
import { Flashcard } from './entities/flashcard.entity';
import { FlashcardStudyLog } from './entities/flashcard-study-log.entity';
import { SharedGroupFlashcard } from './entities/shared-group-flashcard.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FlashcardSet,
      Flashcard,
      FlashcardStudyLog,
      SharedGroupFlashcard,
      GroupMember,
    ]),
  ],
  controllers: [FlashcardsController],
  providers: [FlashcardsService],
  exports: [FlashcardsService],
})
export class FlashcardsModule {}
