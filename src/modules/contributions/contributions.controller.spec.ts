import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request } from 'express';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';
import type { JwtRequestUser } from '@modules/auth/types/jwt-request-user';

const makeReq = (userId: string): Request =>
  ({ user: { id: userId } as JwtRequestUser }) as unknown as Request;

describe('ContributionsController', () => {
  let controller: ContributionsController;
  let service: {
    openEvaluation: ReturnType<typeof vi.fn>;
    closeEvaluation: ReturnType<typeof vi.fn>;
    listRounds: ReturnType<typeof vi.fn>;
    getMyRatingsForRound: ReturnType<typeof vi.fn>;
    submitRating: ReturnType<typeof vi.fn>;
    getAggregatedResults: ReturnType<typeof vi.fn>;
    parseRoundStartedAt: ReturnType<typeof vi.fn>;
  };

  const userId = 'user-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const groupId = 'bbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const taskId = 'cccc-cccc-cccc-cccc-cccccccccccc';
  const roundDate = new Date('2026-04-01T00:00:00.000Z');
  const roundParam = roundDate.toISOString();

  beforeEach(async () => {
    service = {
      openEvaluation: vi.fn().mockResolvedValue({ ratings_created: 3 }),
      closeEvaluation: vi.fn().mockResolvedValue({ closed: true }),
      listRounds: vi.fn().mockResolvedValue([]),
      getMyRatingsForRound: vi.fn().mockResolvedValue([]),
      submitRating: vi.fn().mockResolvedValue({ score: 8 }),
      getAggregatedResults: vi.fn().mockResolvedValue([]),
      parseRoundStartedAt: vi.fn().mockReturnValue(roundDate),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContributionsController],
      providers: [{ provide: ContributionsService, useValue: service }],
    }).compile();

    controller = module.get<ContributionsController>(ContributionsController);
  });

  describe('openEvaluation', () => {
    it('delegates to service.openEvaluation with groupId, userId, and due_date', async () => {
      const dueDate = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const result = await controller.openEvaluation(makeReq(userId), groupId, {
        due_date: dueDate,
      });

      expect(service.openEvaluation).toHaveBeenCalledWith(
        groupId,
        userId,
        dueDate,
      );
      expect(result).toEqual({ ratings_created: 3 });
    });
  });

  describe('closeEvaluation', () => {
    it('parses roundStartedAt and delegates to service.closeEvaluation', async () => {
      const result = await controller.closeEvaluation(
        makeReq(userId),
        groupId,
        roundParam,
      );

      expect(service.parseRoundStartedAt).toHaveBeenCalledWith(roundParam);
      expect(service.closeEvaluation).toHaveBeenCalledWith(
        groupId,
        userId,
        roundDate,
      );
      expect(result).toEqual({ closed: true });
    });
  });

  describe('listRounds', () => {
    it('returns rounds list from service', async () => {
      service.listRounds.mockResolvedValue([{ started_at: roundDate }]);

      const result = await controller.listRounds(makeReq(userId), groupId);

      expect(service.listRounds).toHaveBeenCalledWith(groupId, userId);
      expect(result).toHaveLength(1);
    });
  });

  describe('myRatings', () => {
    it('parses roundStartedAt and returns ratings', async () => {
      service.getMyRatingsForRound.mockResolvedValue([
        { task_id: taskId, score: null },
      ]);

      const result = await controller.myRatings(
        makeReq(userId),
        groupId,
        roundParam,
      );

      expect(service.parseRoundStartedAt).toHaveBeenCalledWith(roundParam);
      expect(service.getMyRatingsForRound).toHaveBeenCalledWith(
        groupId,
        roundDate,
        userId,
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('submitRating', () => {
    it('parses roundStartedAt and delegates submitRating', async () => {
      const result = await controller.submitRating(
        makeReq(userId),
        groupId,
        roundParam,
        taskId,
        { score: 8 },
      );

      expect(service.parseRoundStartedAt).toHaveBeenCalledWith(roundParam);
      expect(service.submitRating).toHaveBeenCalledWith(
        groupId,
        roundDate,
        userId,
        taskId,
        8,
      );
      expect(result).toEqual({ score: 8 });
    });
  });

  describe('results', () => {
    it('parses roundStartedAt and returns aggregated results', async () => {
      service.getAggregatedResults.mockResolvedValue([
        { user_id: userId, average: 7.5 },
      ]);

      const result = await controller.results(
        makeReq(userId),
        groupId,
        roundParam,
      );

      expect(service.parseRoundStartedAt).toHaveBeenCalledWith(roundParam);
      expect(service.getAggregatedResults).toHaveBeenCalledWith(
        groupId,
        roundDate,
        userId,
      );
      expect(result).toHaveLength(1);
    });
  });
});
