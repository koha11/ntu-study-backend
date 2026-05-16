import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  /** Message-ID of the thread-root email; adds In-Reply-To + References headers. */
  inReplyTo?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const mailHost = this.configService.get<string>('MAIL_HOST', 'localhost');
    const mailPort = this.configService.get<number>('MAIL_PORT', 1025);
    const mailUser = this.configService.get<string>(
      'MAIL_USER',
      'test@ntu-study.local',
    );
    const mailPassword = this.configService.get<string>(
      'MAIL_PASSWORD',
      'test',
    );

    this.transporter = nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: mailPort === 465,
      auth: {
        user: mailUser,
        pass: mailPassword,
      },
    });

    this.transporter.verify((err) => {
      if (err) {
        this.logger.warn(`Email service connection failed: ${err.message}`);
      } else {
        this.logger.log(`Email service ready at ${mailHost}:${mailPort}`);
      }
    });
  }

  /**
   * Low-level send. Returns the nodemailer Message-ID on success, null on failure.
   * Callers that started a thread should store this ID; follow-up emails pass it
   * back via options.inReplyTo to keep replies in the same thread.
   */
  async send(options: EmailOptions): Promise<string | null> {
    try {
      const mailFrom = this.configService.get<string>(
        'MAIL_FROM',
        'noreply@ntu-study.local',
      );

      const mailOptions: Record<string, unknown> = {
        from: mailFrom,
        to: Array.isArray(options.to) ? options.to.join(',') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        cc: options.cc
          ? Array.isArray(options.cc)
            ? options.cc.join(',')
            : options.cc
          : undefined,
        bcc: options.bcc
          ? Array.isArray(options.bcc)
            ? options.bcc.join(',')
            : options.bcc
          : undefined,
      };

      if (options.inReplyTo) {
        mailOptions.inReplyTo = options.inReplyTo;
        mailOptions.references = options.inReplyTo;
      }

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent: ${info.messageId} to ${options.to}`);
      return info.messageId as string;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send email to ${options.to}: ${errorMessage}`,
      );
      return null;
    }
  }

  private groupUrl(groupId: string): string {
    const base =
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/$/, '') ??
      'http://localhost:5173';
    return `${base}/groups/${groupId}`;
  }

  async sendGroupCreatedEmail(params: {
    toEmail: string;
    leaderName: string;
    groupName: string;
    groupUrl: string;
    threadMessageId?: string;
  }): Promise<string | null> {
    const { toEmail, leaderName, groupName, groupUrl, threadMessageId } =
      params;
    return this.send({
      to: toEmail,
      subject: `Your group "${groupName}" has been created`,
      html: `
        <h2>Group Created Successfully</h2>
        <p>Hi ${leaderName},</p>
        <p>Your study group <strong>${groupName}</strong> has been created. You can start inviting members now.</p>
        <p><a href="${groupUrl}">Open your group</a></p>
      `,
      text: `Hi ${leaderName}, your group "${groupName}" has been created.\n${groupUrl}`,
      inReplyTo: threadMessageId,
    });
  }

  async sendGroupInvitation(
    userEmail: string,
    inviterName: string,
    groupName: string,
    invitationLink: string,
    threadMessageId?: string,
  ): Promise<string | null> {
    return this.send({
      to: userEmail,
      subject: `You're invited to join ${groupName}`,
      html: `
        <h2>Group Invitation</h2>
        <p>${inviterName} has invited you to join the study group <strong>${groupName}</strong>.</p>
        <p><a href="${invitationLink}">Accept Invitation</a></p>
      `,
      text: `You're invited to join ${groupName}.\nAccept here: ${invitationLink}`,
      inReplyTo: threadMessageId,
    });
  }

  async sendNotification(
    userEmail: string,
    title: string,
    message: string,
  ): Promise<string | null> {
    return this.send({
      to: userEmail,
      subject: title,
      html: `
        <h2>${title}</h2>
        <p>${message}</p>
      `,
      text: `${title}\n${message}`,
    });
  }

  async sendTaskAssignedEmail(params: {
    toEmail: string;
    taskTitle: string;
    groupName: string;
    taskUrl: string;
    threadMessageId?: string;
  }): Promise<string | null> {
    const { toEmail, taskTitle, groupName, taskUrl, threadMessageId } = params;
    return this.send({
      to: toEmail,
      subject: `New task assigned: ${taskTitle}`,
      html: `
        <h2>You were assigned a task</h2>
        <p>You have been assigned <strong>${taskTitle}</strong> in <strong>${groupName}</strong>.</p>
        <p><a href="${taskUrl}">Open group tasks</a></p>
      `,
      text: `You were assigned "${taskTitle}" in ${groupName}.\n${taskUrl}`,
      inReplyTo: threadMessageId,
    });
  }

  async sendTaskPendingReviewEmail(params: {
    toEmail: string;
    taskTitle: string;
    groupName: string;
    submitterName: string;
    taskUrl: string;
    threadMessageId?: string;
  }): Promise<string | null> {
    const {
      toEmail,
      taskTitle,
      groupName,
      submitterName,
      taskUrl,
      threadMessageId,
    } = params;
    return this.send({
      to: toEmail,
      subject: `Task ready for review: ${taskTitle}`,
      html: `
        <h2>Task submitted for review</h2>
        <p><strong>${submitterName}</strong> submitted <strong>${taskTitle}</strong> in <strong>${groupName}</strong> for your review.</p>
        <p><a href="${taskUrl}">Open group tasks</a></p>
      `,
      text: `${submitterName} submitted "${taskTitle}" in ${groupName} for review.\n${taskUrl}`,
      inReplyTo: threadMessageId,
    });
  }

  async sendTaskReviewResultEmail(params: {
    toEmail: string;
    taskTitle: string;
    groupName: string;
    outcome: 'done' | 'failed';
    taskUrl: string;
    threadMessageId?: string;
  }): Promise<string | null> {
    const { toEmail, taskTitle, groupName, outcome, taskUrl, threadMessageId } =
      params;
    const label = outcome === 'done' ? 'approved (Done)' : 'marked as Failed';
    return this.send({
      to: toEmail,
      subject: `Task ${outcome === 'done' ? 'approved' : 'update'}: ${taskTitle}`,
      html: `
        <h2>Task ${label}</h2>
        <p>Your task <strong>${taskTitle}</strong> in <strong>${groupName}</strong> was ${label}.</p>
        <p><a href="${taskUrl}">Open group tasks</a></p>
      `,
      text: `Your task "${taskTitle}" in ${groupName} was ${label}.\n${taskUrl}`,
      inReplyTo: threadMessageId,
    });
  }

  async sendContributionOpenEmail(params: {
    toEmail: string;
    groupName: string;
    dueDate: Date;
    groupUrl: string;
    threadMessageId?: string;
  }): Promise<string | null> {
    const { toEmail, groupName, dueDate, groupUrl, threadMessageId } = params;
    return this.send({
      to: toEmail,
      subject: `Peer evaluation is open: ${groupName}`,
      html: `
        <h2>Peer Evaluation Round Opened</h2>
        <p>A new peer evaluation round has started for your group <strong>${groupName}</strong>.</p>
        <p>Please rate your teammates' contributions before <strong>${dueDate.toLocaleDateString()}</strong>.</p>
        <p><a href="${groupUrl}">Go to group</a></p>
      `,
      text: `Peer evaluation is open for ${groupName}. Rate by ${dueDate.toLocaleDateString()}.\n${groupUrl}`,
      inReplyTo: threadMessageId,
    });
  }

  /**
   * Sends a single batched reminder listing all overdue tasks for one group.
   * Replaces the old per-task sendTaskReminder for group tasks.
   */
  async sendBatchedTaskReminderEmail(params: {
    toEmail: string;
    groupName: string;
    tasks: { title: string; dueDate: Date }[];
    groupUrl: string;
    threadMessageId?: string;
  }): Promise<string | null> {
    const { toEmail, groupName, tasks, groupUrl, threadMessageId } = params;
    const taskRows = tasks
      .map(
        (t) =>
          `<li><strong>${t.title}</strong> — due ${t.dueDate.toLocaleString()}</li>`,
      )
      .join('');
    return this.send({
      to: toEmail,
      subject: `Overdue task reminder: ${groupName}`,
      html: `
        <h2>Overdue Tasks — ${groupName}</h2>
        <p>The following tasks are overdue:</p>
        <ul>${taskRows}</ul>
        <p>Please complete them as soon as possible.</p>
        <p><a href="${groupUrl}">Open group tasks</a></p>
      `,
      text:
        `Overdue tasks in ${groupName}:\n` +
        tasks.map((t) => `- ${t.title} (due ${t.dueDate.toLocaleString()})`).join('\n') +
        `\n${groupUrl}`,
      inReplyTo: threadMessageId,
    });
  }
}
