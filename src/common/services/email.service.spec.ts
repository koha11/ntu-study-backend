import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailService } from './email.service';

const { mockSendMail, mockVerify } = vi.hoisted(() => ({
  mockSendMail: vi.fn(),
  mockVerify: vi.fn((_cb: (err: Error | null) => void) => {}),
}));

vi.mock('nodemailer', () => {
  const transporter = { sendMail: mockSendMail, verify: mockVerify };
  const createTransport = vi.fn(() => transporter);
  return { createTransport, default: { createTransport } };
});

describe('EmailService', () => {
  let service: EmailService;
  let configService: { get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockSendMail.mockReset();
    mockVerify.mockReset();
    mockVerify.mockImplementation((_cb: (err: Error | null) => void) => {});

    configService = {
      get: vi.fn((key: string, def?: unknown) => {
        const map: Record<string, unknown> = {
          MAIL_HOST: 'localhost',
          MAIL_PORT: 1025,
          MAIL_USER: 'test@ntu-study.local',
          MAIL_PASSWORD: 'test',
          MAIL_FROM: 'noreply@ntu-study.local',
          FRONTEND_URL: 'http://localhost:5173',
        };
        return map[key] ?? def;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  describe('send()', () => {
    it('returns the messageId string on success', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<msg-1@ntu-study.local>' });

      const result = await service.send({ to: 'a@b.com', subject: 'Hi', text: 'Hello' });

      expect(result).toBe('<msg-1@ntu-study.local>');
    });

    it('returns null on transport failure', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await service.send({ to: 'a@b.com', subject: 'Hi', text: 'Hello' });

      expect(result).toBeNull();
    });

    it('passes In-Reply-To and References headers when inReplyTo is provided', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<msg-2@ntu-study.local>' });
      const threadRoot = '<root@ntu-study.local>';

      await service.send({ to: 'a@b.com', subject: 'Re: Hi', text: 'Hello', inReplyTo: threadRoot });

      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.inReplyTo).toBe(threadRoot);
      expect(callArg.references).toBe(threadRoot);
    });

    it('omits threading headers when inReplyTo is not provided', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<msg-3@ntu-study.local>' });

      await service.send({ to: 'a@b.com', subject: 'Hi', text: 'Hello' });

      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.inReplyTo).toBeUndefined();
      expect(callArg.references).toBeUndefined();
    });
  });

  describe('sendGroupCreatedEmail()', () => {
    it('sends an email with group creation content and returns messageId', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<created@ntu-study.local>' });

      const result = await service.sendGroupCreatedEmail({
        toEmail: 'leader@test.com',
        leaderName: 'Alice',
        groupName: 'Study Squad',
        groupUrl: 'http://localhost:5173/groups/g1',
      });

      expect(result).toBe('<created@ntu-study.local>');
      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.to).toBe('leader@test.com');
      expect(callArg.subject).toContain('Study Squad');
      expect(callArg.html).toContain('Alice');
      expect(callArg.html).toContain('Study Squad');
    });

    it('passes inReplyTo when threadMessageId is provided', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<msg@ntu-study.local>' });

      await service.sendGroupCreatedEmail({
        toEmail: 'leader@test.com',
        leaderName: 'Alice',
        groupName: 'Squad',
        groupUrl: 'http://localhost:5173/groups/g1',
        threadMessageId: '<root@ntu-study.local>',
      });

      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.inReplyTo).toBe('<root@ntu-study.local>');
    });
  });

  describe('sendGroupInvitation()', () => {
    it('returns the messageId on success', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<inv@ntu-study.local>' });

      const result = await service.sendGroupInvitation(
        'invitee@test.com',
        'Bob',
        'Squad',
        'http://localhost:5173/invitations/tok/accept',
      );

      expect(result).toBe('<inv@ntu-study.local>');
    });

    it('passes inReplyTo when threadMessageId is provided', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<msg@ntu-study.local>' });

      await service.sendGroupInvitation(
        'invitee@test.com',
        'Bob',
        'Squad',
        'http://link',
        '<root@ntu-study.local>',
      );

      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.inReplyTo).toBe('<root@ntu-study.local>');
    });
  });

  describe('sendContributionOpenEmail()', () => {
    it('sends an email with peer-review content and returns messageId', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<contrib@ntu-study.local>' });
      const due = new Date('2026-06-01T00:00:00Z');

      const result = await service.sendContributionOpenEmail({
        toEmail: 'member@test.com',
        groupName: 'Study Squad',
        dueDate: due,
        groupUrl: 'http://localhost:5173/groups/g1',
      });

      expect(result).toBe('<contrib@ntu-study.local>');
      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.to).toBe('member@test.com');
      expect(callArg.subject).toContain('Study Squad');
      expect(callArg.html).toContain('Study Squad');
    });

    it('passes inReplyTo when threadMessageId is provided', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<msg@ntu-study.local>' });

      await service.sendContributionOpenEmail({
        toEmail: 'member@test.com',
        groupName: 'Squad',
        dueDate: new Date(),
        groupUrl: 'http://localhost:5173/groups/g1',
        threadMessageId: '<root@ntu-study.local>',
      });

      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.inReplyTo).toBe('<root@ntu-study.local>');
    });
  });

  describe('sendBatchedTaskReminderEmail()', () => {
    it('sends one email containing all overdue tasks for the group', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<batch@ntu-study.local>' });
      const tasks = [
        { title: 'Task A', dueDate: new Date('2026-05-01') },
        { title: 'Task B', dueDate: new Date('2026-05-02') },
      ];

      const result = await service.sendBatchedTaskReminderEmail({
        toEmail: 'user@test.com',
        groupName: 'Study Squad',
        tasks,
        groupUrl: 'http://localhost:5173/groups/g1',
      });

      expect(result).toBe('<batch@ntu-study.local>');
      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.to).toBe('user@test.com');
      expect(callArg.html).toContain('Task A');
      expect(callArg.html).toContain('Task B');
      expect(callArg.html).toContain('Study Squad');
    });

    it('passes inReplyTo when threadMessageId is provided', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<msg@ntu-study.local>' });

      await service.sendBatchedTaskReminderEmail({
        toEmail: 'user@test.com',
        groupName: 'Squad',
        tasks: [{ title: 'T1', dueDate: new Date() }],
        groupUrl: 'http://localhost:5173/groups/g1',
        threadMessageId: '<root@ntu-study.local>',
      });

      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.inReplyTo).toBe('<root@ntu-study.local>');
    });
  });

  describe('sendTaskAssignedEmail()', () => {
    it('returns messageId and passes inReplyTo when threadMessageId provided', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<assign@ntu-study.local>' });

      const result = await service.sendTaskAssignedEmail({
        toEmail: 'dev@test.com',
        taskTitle: 'Build feature',
        groupName: 'Squad',
        taskUrl: 'http://localhost:5173/groups/g1',
        threadMessageId: '<root@ntu-study.local>',
      });

      expect(result).toBe('<assign@ntu-study.local>');
      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.inReplyTo).toBe('<root@ntu-study.local>');
    });
  });

  describe('sendTaskPendingReviewEmail()', () => {
    it('returns messageId and passes inReplyTo when threadMessageId provided', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<review@ntu-study.local>' });

      const result = await service.sendTaskPendingReviewEmail({
        toEmail: 'leader@test.com',
        taskTitle: 'Build feature',
        groupName: 'Squad',
        submitterName: 'Alice',
        taskUrl: 'http://localhost:5173/groups/g1',
        threadMessageId: '<root@ntu-study.local>',
      });

      expect(result).toBe('<review@ntu-study.local>');
      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.inReplyTo).toBe('<root@ntu-study.local>');
    });
  });

  describe('sendTaskReviewResultEmail()', () => {
    it('returns messageId and passes inReplyTo when threadMessageId provided', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<result@ntu-study.local>' });

      const result = await service.sendTaskReviewResultEmail({
        toEmail: 'dev@test.com',
        taskTitle: 'Build feature',
        groupName: 'Squad',
        outcome: 'done',
        taskUrl: 'http://localhost:5173/groups/g1',
        threadMessageId: '<root@ntu-study.local>',
      });

      expect(result).toBe('<result@ntu-study.local>');
      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.inReplyTo).toBe('<root@ntu-study.local>');
    });
  });
});
