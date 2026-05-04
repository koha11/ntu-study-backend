import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';

describe('InvitationsController', () => {
  let controller: InvitationsController;
  let mockFrontendUrl = 'http://localhost:5173';
  let invitationsService: {
    acceptInvitation: ReturnType<typeof vi.fn>;
    validateInvitationToken: ReturnType<typeof vi.fn>;
    findGroupInvitationsForLeader: ReturnType<typeof vi.fn>;
    resendGroupInvitation: ReturnType<typeof vi.fn>;
    getPendingInvitationTokenForRecipient: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockFrontendUrl = 'http://localhost:5173';
    invitationsService = {
      acceptInvitation: vi.fn(),
      validateInvitationToken: vi.fn(),
      findGroupInvitationsForLeader: vi.fn(),
      resendGroupInvitation: vi.fn(),
      getPendingInvitationTokenForRecipient: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationsController],
      providers: [
        { provide: InvitationsService, useValue: invitationsService },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) =>
              key === 'FRONTEND_URL' ? mockFrontendUrl : undefined,
            ),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(InvitationsController);
  });

  it('acceptInvitation passes token and body', async () => {
    await controller.acceptInvitation('tok', { full_name: 'A' });
    expect(invitationsService.acceptInvitation).toHaveBeenCalledWith('tok', {
      full_name: 'A',
    });
  });

  it('getPendingInvitationToken forwards invitation id and user id', async () => {
    invitationsService.getPendingInvitationTokenForRecipient.mockResolvedValue({
      token: 'abc',
    });

    const result = await controller.getPendingInvitationToken(
      { user: { id: 'uid1' } } as Request,
      'inv-1',
    );

    expect(
      invitationsService.getPendingInvitationTokenForRecipient,
    ).toHaveBeenCalledWith('inv-1', 'uid1');
    expect(result).toEqual({ token: 'abc' });
  });

  it('redirectAcceptPage redirects to SPA when hosts differ', () => {
    const res = {
      redirect: vi.fn(),
    } as unknown as Response;
    const req = {
      protocol: 'http',
      get: vi.fn((name: string) =>
        name === 'host' ? 'localhost:3000' : undefined,
      ),
      originalUrl: '/invitations/tok123/accept',
    } as unknown as Request;
    controller.redirectAcceptPage(req, 'tok123', res);
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      'http://localhost:5173/invitations/tok123/accept',
    );
  });

  it('redirectAcceptPage returns 400 when FRONTEND_URL would loop with API host', () => {
    mockFrontendUrl = 'http://localhost:3000';
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;
    const req = {
      protocol: 'http',
      get: vi.fn((name: string) =>
        name === 'host' ? 'localhost:3000' : undefined,
      ),
      originalUrl: '/invitations/tok123/accept',
    } as unknown as Request;
    controller.redirectAcceptPage(req, 'tok123', res);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('FRONTEND_URL'),
      }),
    );
  });

  it('findGroupInvitations passes leader user id', async () => {
    await controller.findGroupInvitations(
      { user: { id: 'u1' } } as never,
      'g99',
    );
    expect(
      invitationsService.findGroupInvitationsForLeader,
    ).toHaveBeenCalledWith('g99', 'u1');
  });

  it('resendGroupInvitation passes groupId, invitationId, and leader id', async () => {
    await controller.resendGroupInvitation(
      { user: { id: 'leader-1' } } as never,
      'g1',
      'inv-2',
    );
    expect(invitationsService.resendGroupInvitation).toHaveBeenCalledWith({
      groupId: 'g1',
      invitationId: 'inv-2',
      leaderUserId: 'leader-1',
    });
  });
});
