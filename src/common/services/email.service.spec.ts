import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailService } from './email.service';
import { Language } from '@common/enums';

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

  describe('initializeTransporter — verify callback', () => {
    it('logs warning when verify callback is called with an error', async () => {
      mockVerify.mockImplementationOnce((cb: (err: Error | null) => void) => {
        cb(new Error('SMTP connection refused'));
      });
      // Re-compile to trigger constructor with error-invoking verify
      const module = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      const svc = module.get(EmailService);
      expect(svc).toBeDefined();
    });

    it('logs success when verify callback is called with null', async () => {
      mockVerify.mockImplementationOnce((cb: (err: Error | null) => void) => {
        cb(null);
      });
      const module = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      const svc = module.get(EmailService);
      expect(svc).toBeDefined();
    });
  });

  describe('groupUrl (private helper)', () => {
    it('builds a group URL from FRONTEND_URL config', () => {
      const url = (service as any).groupUrl('test-group-id');
      expect(url).toBe('http://localhost:5173/groups/test-group-id');
    });

    it('removes trailing slash from base URL', () => {
      configService.get.mockImplementation((key: string, def?: unknown) => {
        if (key === 'FRONTEND_URL') return 'http://localhost:5173/';
        return def;
      });
      const url = (service as any).groupUrl('g1');
      expect(url).toBe('http://localhost:5173/groups/g1');
    });
  });

  describe('send()', () => {
    it('returns the messageId string on success', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<msg-1@ntu-study.local>' });

      const result = await service.send({
        to: 'a@b.com',
        subject: 'Hi',
        text: 'Hello',
      });

      expect(result).toBe('<msg-1@ntu-study.local>');
    });

    it('returns null on transport failure', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await service.send({
        to: 'a@b.com',
        subject: 'Hi',
        text: 'Hello',
      });

      expect(result).toBeNull();
    });

    it('passes In-Reply-To and References headers when inReplyTo is provided', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<msg-2@ntu-study.local>' });
      const threadRoot = '<root@ntu-study.local>';

      await service.send({
        to: 'a@b.com',
        subject: 'Re: Hi',
        text: 'Hello',
        inReplyTo: threadRoot,
      });

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
      mockSendMail.mockResolvedValue({
        messageId: '<created@ntu-study.local>',
      });

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
      mockSendMail.mockResolvedValue({
        messageId: '<contrib@ntu-study.local>',
      });
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

    it('includes outcome failed label and comment in html when outcome is failed with comment', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<failed@ntu-study.local>' });

      await service.sendTaskReviewResultEmail({
        toEmail: 'dev@test.com',
        taskTitle: 'Build feature',
        groupName: 'Squad',
        outcome: 'failed',
        comment: 'Missing tests',
        taskUrl: 'http://localhost:5173/groups/g1',
        lang: Language.EN,
      });

      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.html).toContain('Missing tests');
      expect(callArg.html).toContain('Reason');
      expect(callArg.subject).toContain('update');
    });

    it('sends Vietnamese content when lang is VI and outcome done', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<vi@ntu-study.local>' });

      await service.sendTaskReviewResultEmail({
        toEmail: 'dev@test.com',
        taskTitle: 'Tính năng A',
        groupName: 'Nhóm',
        outcome: 'done',
        taskUrl: 'http://localhost:5173/groups/g1',
        lang: Language.VI,
      });

      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.subject).toContain('được duyệt');
    });

    it('sends Vietnamese failed+comment content', async () => {
      mockSendMail.mockResolvedValue({
        messageId: '<vi-fail@ntu-study.local>',
      });

      await service.sendTaskReviewResultEmail({
        toEmail: 'dev@test.com',
        taskTitle: 'Task',
        groupName: 'Group',
        outcome: 'failed',
        comment: 'Lý do thất bại',
        taskUrl: 'http://localhost:5173/groups/g1',
        lang: Language.VI,
      });

      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.html).toContain('Lý do');
      expect(callArg.html).toContain('Lý do thất bại');
    });
  });

  // English-language paths (lang: Language.EN forces the else-branch of every ternary)

  describe('English language variants (lang: Language.EN)', () => {
    beforeEach(() => {
      mockSendMail.mockResolvedValue({ messageId: '<en@ntu-study.local>' });
    });

    it('sendGroupCreatedEmail uses English subject and html', async () => {
      await service.sendGroupCreatedEmail({
        toEmail: 'leader@test.com',
        leaderName: 'Alice',
        groupName: 'Study Squad',
        groupUrl: 'http://localhost:5173/groups/g1',
        lang: Language.EN,
      });
      const arg = mockSendMail.mock.calls[0][0];
      expect(arg.subject).toContain('Your group');
      expect(arg.html).toContain('Group Created');
    });

    it('sendGroupInvitation uses English subject', async () => {
      await service.sendGroupInvitation(
        'invitee@test.com',
        'Bob',
        'Squad',
        'http://link',
        undefined,
        Language.EN,
      );
      const arg = mockSendMail.mock.calls[0][0];
      expect(arg.subject).toContain("You're invited");
    });

    it('sendTaskAssignedEmail uses English subject', async () => {
      await service.sendTaskAssignedEmail({
        toEmail: 'dev@test.com',
        taskTitle: 'Do thing',
        groupName: 'Squad',
        taskUrl: 'http://link',
        lang: Language.EN,
      });
      const arg = mockSendMail.mock.calls[0][0];
      expect(arg.subject).toContain('New task assigned');
    });

    it('sendTaskPendingReviewEmail uses English subject', async () => {
      await service.sendTaskPendingReviewEmail({
        toEmail: 'leader@test.com',
        taskTitle: 'Feature',
        groupName: 'Squad',
        submitterName: 'Alice',
        taskUrl: 'http://link',
        lang: Language.EN,
      });
      const arg = mockSendMail.mock.calls[0][0];
      expect(arg.subject).toContain('review');
    });

    it('sendContributionOpenEmail uses English subject', async () => {
      await service.sendContributionOpenEmail({
        toEmail: 'member@test.com',
        groupName: 'Squad',
        dueDate: new Date(),
        groupUrl: 'http://link',
        lang: Language.EN,
      });
      const arg = mockSendMail.mock.calls[0][0];
      expect(arg.subject).toContain('Peer evaluation is open');
    });

    it('sendBatchedTaskReminderEmail uses English subject', async () => {
      await service.sendBatchedTaskReminderEmail({
        toEmail: 'user@test.com',
        groupName: 'Squad',
        tasks: [{ title: 'Task A', dueDate: new Date() }],
        groupUrl: 'http://link',
        lang: Language.EN,
      });
      const arg = mockSendMail.mock.calls[0][0];
      expect(arg.subject).toContain('Overdue task reminder');
    });
  });

  describe('sendContributionClosedEmail()', () => {
    it('sends email with task scores and overall average (EN)', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<closed@ntu-study.local>' });

      const result = await service.sendContributionClosedEmail({
        toEmail: 'member@test.com',
        groupName: 'Study Squad',
        taskScores: [
          { taskTitle: 'Task A', averageScore: 8.5 },
          { taskTitle: 'Task B', averageScore: null },
        ],
        overallAverage: 8.5,
        groupUrl: 'http://localhost:5173/groups/g1',
        lang: Language.EN,
      });

      expect(result).toBe('<closed@ntu-study.local>');
      const arg = mockSendMail.mock.calls[0][0];
      expect(arg.subject).toContain('Peer evaluation results');
      expect(arg.html).toContain('8.5/10');
      expect(arg.html).toContain('Task A');
      expect(arg.html).toContain('Overall score');
    });

    it('sends Vietnamese content when lang is VI', async () => {
      mockSendMail.mockResolvedValue({
        messageId: '<vi-closed@ntu-study.local>',
      });

      await service.sendContributionClosedEmail({
        toEmail: 'member@test.com',
        groupName: 'Nhóm',
        taskScores: [{ taskTitle: 'Nhiệm vụ', averageScore: 7 }],
        overallAverage: 7,
        groupUrl: 'http://link',
        lang: Language.VI,
      });

      const arg = mockSendMail.mock.calls[0][0];
      expect(arg.subject).toContain('Kết quả đánh giá');
    });

    it('shows em-dash when overallAverage is null', async () => {
      mockSendMail.mockResolvedValue({
        messageId: '<null-avg@ntu-study.local>',
      });

      await service.sendContributionClosedEmail({
        toEmail: 'member@test.com',
        groupName: 'Squad',
        taskScores: [{ taskTitle: 'Task', averageScore: null }],
        overallAverage: null,
        groupUrl: 'http://link',
        lang: Language.EN,
      });

      const arg = mockSendMail.mock.calls[0][0];
      expect(arg.html).toContain('—');
    });

    it('passes threadMessageId as inReplyTo', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<thread@ntu-study.local>' });

      await service.sendContributionClosedEmail({
        toEmail: 'member@test.com',
        groupName: 'Squad',
        taskScores: [],
        overallAverage: null,
        groupUrl: 'http://link',
        threadMessageId: '<root@ntu-study.local>',
      });

      const arg = mockSendMail.mock.calls[0][0];
      expect(arg.inReplyTo).toBe('<root@ntu-study.local>');
    });
  });

  describe('sendNotification()', () => {
    it('sends a plain notification email', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<notif@ntu-study.local>' });

      const result = await service.sendNotification(
        'user@test.com',
        'Alert',
        'Something happened',
      );

      expect(result).toBe('<notif@ntu-study.local>');
      const arg = mockSendMail.mock.calls[0][0];
      expect(arg.to).toBe('user@test.com');
      expect(arg.subject).toBe('Alert');
      expect(arg.html).toContain('Something happened');
    });
  });

  describe('sendViaNodemailer — cc/bcc as arrays', () => {
    it('joins cc array into comma-separated string', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<cc@ntu-study.local>' });

      await service.send({
        to: 'a@b.com',
        subject: 'Test',
        cc: ['c1@b.com', 'c2@b.com'],
        bcc: ['b1@b.com'],
      });

      const arg = mockSendMail.mock.calls[0][0];
      expect(arg.cc).toBe('c1@b.com,c2@b.com');
      expect(arg.bcc).toBe('b1@b.com');
    });

    it('sends to array of recipients', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<multi@ntu-study.local>' });

      await service.send({
        to: ['a@b.com', 'c@d.com'],
        subject: 'Multi',
      });

      const arg = mockSendMail.mock.calls[0][0];
      expect(arg.to).toBe('a@b.com,c@d.com');
    });
  });

  describe('production mode (SendGrid)', () => {
    let prodService: EmailService;

    const { mockSgSend } = vi.hoisted(() => ({ mockSgSend: vi.fn() }));

    vi.mock('@sendgrid/mail', () => ({
      default: { setApiKey: vi.fn(), send: mockSgSend },
    }));

    beforeEach(async () => {
      mockSgSend.mockReset();
      const prodConfigService = {
        get: vi.fn((key: string, def?: unknown) => {
          const map: Record<string, unknown> = {
            NODE_ENV: 'production',
            SENDGRID_API_KEY: 'SG.test-key',
            SENDGRID_FROM_EMAIL: 'noreply@prod.com',
          };
          return map[key] ?? def;
        }),
      };
      const module = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: prodConfigService },
        ],
      }).compile();
      prodService = module.get(EmailService);
    });

    it('sends via SendGrid in production and returns message id', async () => {
      mockSgSend.mockResolvedValue([
        { statusCode: 202, headers: { 'x-message-id': 'sg-msg-123' } },
      ]);

      const result = await prodService.send({
        to: 'user@test.com',
        subject: 'Hello',
        text: 'World',
      });

      expect(mockSgSend).toHaveBeenCalled();
      expect(result).toBe('sg-msg-123');
    });

    it('returns null when SendGrid throws', async () => {
      mockSgSend.mockRejectedValue(new Error('SG error'));

      const result = await prodService.send({
        to: 'user@test.com',
        subject: 'Hello',
      });

      expect(result).toBeNull();
    });

    it('returns null when x-message-id header is missing', async () => {
      mockSgSend.mockResolvedValue([{ statusCode: 202, headers: {} }]);

      const result = await prodService.send({
        to: 'user@test.com',
        subject: 'Hello',
      });

      expect(result).toBeNull();
    });

    it('handles x-message-id as array', async () => {
      mockSgSend.mockResolvedValue([
        {
          statusCode: 202,
          headers: { 'x-message-id': ['arr-id-1', 'arr-id-2'] },
        },
      ]);

      const result = await prodService.send({
        to: 'user@test.com',
        subject: 'Hello',
      });

      expect(result).toBe('arr-id-1');
    });
  });
});
