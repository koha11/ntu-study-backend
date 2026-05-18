import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import sgMail from '@sendgrid/mail';
import { Language } from '@common/enums';

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
  private readonly isProd: boolean;

  constructor(private configService: ConfigService) {
    this.isProd = configService.get<string>('NODE_ENV') === 'production';
    this.initializeTransporter();
  }

  private initializeTransporter() {
    if (this.isProd) {
      const apiKey = this.configService.get<string>('SENDGRID_API_KEY', '');
      sgMail.setApiKey(apiKey);
      this.logger.log('Email service ready (SendGrid)');
      return;
    }

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
   * Low-level send. Returns a Message-ID on success, null on failure.
   * Callers that started a thread should store this ID; follow-up emails pass it
   * back via options.inReplyTo to keep replies in the same thread.
   */
  async send(options: EmailOptions): Promise<string | null> {
    return this.isProd
      ? this.sendViaSendGrid(options)
      : this.sendViaNodemailer(options);
  }

  private async sendViaSendGrid(options: EmailOptions): Promise<string | null> {
    const toStr = Array.isArray(options.to)
      ? options.to.join(', ')
      : options.to;
    try {
      const from = this.configService.get<string>('SENDGRID_FROM_EMAIL', '');
      const msg = {
        to: options.to,
        from,
        subject: options.subject,
        text: options.text,
        html: options.html,
        ...(options.cc && { cc: options.cc }),
        ...(options.bcc && { bcc: options.bcc }),
        ...(options.inReplyTo && {
          headers: {
            'In-Reply-To': options.inReplyTo,
            References: options.inReplyTo,
          },
        }),
      } as sgMail.MailDataRequired;

      const [response] = await sgMail.send(msg);
      const headers = response.headers as Record<string, string | string[]>;
      const rawId = headers['x-message-id'];
      const messageId = Array.isArray(rawId) ? rawId[0] : rawId;
      this.logger.log(
        `Email sent via SendGrid (${response.statusCode}) to ${toStr}`,
      );
      return messageId ?? null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send email via SendGrid to ${toStr}: ${errorMessage}`,
      );
      return null;
    }
  }

  private async sendViaNodemailer(
    options: EmailOptions,
  ): Promise<string | null> {
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
    lang?: Language;
  }): Promise<string | null> {
    const { toEmail, leaderName, groupName, groupUrl, threadMessageId, lang } =
      params;
    const vi = lang !== Language.EN;
    return this.send({
      to: toEmail,
      subject: vi
        ? `Nhóm "${groupName}" của bạn đã được tạo`
        : `Your group "${groupName}" has been created`,
      html: vi
        ? `
        <h2>Tạo nhóm thành công</h2>
        <p>Xin chào ${leaderName},</p>
        <p>Nhóm học tập <strong>${groupName}</strong> của bạn đã được tạo. Bạn có thể bắt đầu mời thành viên ngay bây giờ.</p>
        <p><a href="${groupUrl}">Mở nhóm của bạn</a></p>
      `
        : `
        <h2>Group Created Successfully</h2>
        <p>Hi ${leaderName},</p>
        <p>Your study group <strong>${groupName}</strong> has been created. You can start inviting members now.</p>
        <p><a href="${groupUrl}">Open your group</a></p>
      `,
      text: vi
        ? `Xin chào ${leaderName}, nhóm "${groupName}" của bạn đã được tạo.\n${groupUrl}`
        : `Hi ${leaderName}, your group "${groupName}" has been created.\n${groupUrl}`,
      inReplyTo: threadMessageId,
    });
  }

  async sendGroupInvitation(
    userEmail: string,
    inviterName: string,
    groupName: string,
    invitationLink: string,
    threadMessageId?: string,
    lang?: Language,
  ): Promise<string | null> {
    const vi = lang !== Language.EN;
    return this.send({
      to: userEmail,
      subject: vi
        ? `Bạn được mời tham gia ${groupName}`
        : `You're invited to join ${groupName}`,
      html: vi
        ? `
        <h2>Lời mời tham gia nhóm</h2>
        <p>${inviterName} đã mời bạn tham gia nhóm học tập <strong>${groupName}</strong>.</p>
        <p><a href="${invitationLink}">Chấp nhận lời mời</a></p>
      `
        : `
        <h2>Group Invitation</h2>
        <p>${inviterName} has invited you to join the study group <strong>${groupName}</strong>.</p>
        <p><a href="${invitationLink}">Accept Invitation</a></p>
      `,
      text: vi
        ? `Bạn được mời tham gia ${groupName}.\nChấp nhận tại đây: ${invitationLink}`
        : `You're invited to join ${groupName}.\nAccept here: ${invitationLink}`,
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
    lang?: Language;
  }): Promise<string | null> {
    const { toEmail, taskTitle, groupName, taskUrl, threadMessageId, lang } =
      params;
    const vi = lang !== Language.EN;
    return this.send({
      to: toEmail,
      subject: vi
        ? `Nhiệm vụ mới được giao: ${taskTitle}`
        : `New task assigned: ${taskTitle}`,
      html: vi
        ? `
        <h2>Bạn được giao nhiệm vụ</h2>
        <p>Bạn đã được giao <strong>${taskTitle}</strong> trong nhóm <strong>${groupName}</strong>.</p>
        <p><a href="${taskUrl}">Xem nhiệm vụ nhóm</a></p>
      `
        : `
        <h2>You were assigned a task</h2>
        <p>You have been assigned <strong>${taskTitle}</strong> in <strong>${groupName}</strong>.</p>
        <p><a href="${taskUrl}">Open group tasks</a></p>
      `,
      text: vi
        ? `Bạn được giao "${taskTitle}" trong ${groupName}.\n${taskUrl}`
        : `You were assigned "${taskTitle}" in ${groupName}.\n${taskUrl}`,
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
    lang?: Language;
  }): Promise<string | null> {
    const {
      toEmail,
      taskTitle,
      groupName,
      submitterName,
      taskUrl,
      threadMessageId,
      lang,
    } = params;
    const vi = lang !== Language.EN;
    return this.send({
      to: toEmail,
      subject: vi
        ? `Nhiệm vụ chờ duyệt: ${taskTitle}`
        : `Task ready for review: ${taskTitle}`,
      html: vi
        ? `
        <h2>Nhiệm vụ đã được nộp để duyệt</h2>
        <p><strong>${submitterName}</strong> đã nộp <strong>${taskTitle}</strong> trong nhóm <strong>${groupName}</strong> để bạn duyệt.</p>
        <p><a href="${taskUrl}">Xem nhiệm vụ nhóm</a></p>
      `
        : `
        <h2>Task submitted for review</h2>
        <p><strong>${submitterName}</strong> submitted <strong>${taskTitle}</strong> in <strong>${groupName}</strong> for your review.</p>
        <p><a href="${taskUrl}">Open group tasks</a></p>
      `,
      text: vi
        ? `${submitterName} đã nộp "${taskTitle}" trong ${groupName} để duyệt.\n${taskUrl}`
        : `${submitterName} submitted "${taskTitle}" in ${groupName} for review.\n${taskUrl}`,
      inReplyTo: threadMessageId,
    });
  }

  async sendTaskReviewResultEmail(params: {
    toEmail: string;
    taskTitle: string;
    groupName: string;
    outcome: 'done' | 'failed';
    comment?: string;
    taskUrl: string;
    threadMessageId?: string;
    lang?: Language;
  }): Promise<string | null> {
    const {
      toEmail,
      taskTitle,
      groupName,
      outcome,
      comment,
      taskUrl,
      threadMessageId,
      lang,
    } = params;
    const vi = lang !== Language.EN;
    const label = vi
      ? outcome === 'done'
        ? 'được duyệt (Hoàn thành)'
        : 'bị đánh dấu Thất bại'
      : outcome === 'done'
        ? 'approved (Done)'
        : 'marked as Failed';
    const commentHtml =
      outcome === 'failed' && comment
        ? `<p><strong>${vi ? 'Lý do' : 'Reason'}:</strong> ${comment}</p>`
        : '';
    const commentText =
      outcome === 'failed' && comment
        ? `\n${vi ? 'Lý do' : 'Reason'}: ${comment}`
        : '';
    return this.send({
      to: toEmail,
      subject: vi
        ? `Nhiệm vụ ${outcome === 'done' ? 'được duyệt' : 'cập nhật'}: ${taskTitle}`
        : `Task ${outcome === 'done' ? 'approved' : 'update'}: ${taskTitle}`,
      html: vi
        ? `
        <h2>Nhiệm vụ ${label}</h2>
        <p>Nhiệm vụ <strong>${taskTitle}</strong> của bạn trong nhóm <strong>${groupName}</strong> đã ${label}.</p>
        ${commentHtml}
        <p><a href="${taskUrl}">Xem nhiệm vụ nhóm</a></p>
      `
        : `
        <h2>Task ${label}</h2>
        <p>Your task <strong>${taskTitle}</strong> in <strong>${groupName}</strong> was ${label}.</p>
        ${commentHtml}
        <p><a href="${taskUrl}">Open group tasks</a></p>
      `,
      text: vi
        ? `Nhiệm vụ "${taskTitle}" của bạn trong ${groupName} đã ${label}.${commentText}\n${taskUrl}`
        : `Your task "${taskTitle}" in ${groupName} was ${label}.${commentText}\n${taskUrl}`,
      inReplyTo: threadMessageId,
    });
  }

  async sendContributionOpenEmail(params: {
    toEmail: string;
    groupName: string;
    dueDate: Date;
    groupUrl: string;
    threadMessageId?: string;
    lang?: Language;
  }): Promise<string | null> {
    const { toEmail, groupName, dueDate, groupUrl, threadMessageId, lang } =
      params;
    const vi = lang !== Language.EN;
    return this.send({
      to: toEmail,
      subject: vi
        ? `Đánh giá đóng góp đã mở: ${groupName}`
        : `Peer evaluation is open: ${groupName}`,
      html: vi
        ? `
        <h2>Vòng đánh giá đồng nghiệp đã bắt đầu</h2>
        <p>Một vòng đánh giá đồng nghiệp mới đã bắt đầu cho nhóm <strong>${groupName}</strong> của bạn.</p>
        <p>Vui lòng đánh giá đóng góp của đồng đội trước <strong>${dueDate.toLocaleDateString()}</strong>.</p>
        <p><a href="${groupUrl}">Đến nhóm</a></p>
      `
        : `
        <h2>Peer Evaluation Round Opened</h2>
        <p>A new peer evaluation round has started for your group <strong>${groupName}</strong>.</p>
        <p>Please rate your teammates' contributions before <strong>${dueDate.toLocaleDateString()}</strong>.</p>
        <p><a href="${groupUrl}">Go to group</a></p>
      `,
      text: vi
        ? `Đánh giá đóng góp đã mở cho ${groupName}. Đánh giá trước ${dueDate.toLocaleDateString()}.\n${groupUrl}`
        : `Peer evaluation is open for ${groupName}. Rate by ${dueDate.toLocaleDateString()}.\n${groupUrl}`,
      inReplyTo: threadMessageId,
    });
  }

  async sendContributionClosedEmail(params: {
    toEmail: string;
    groupName: string;
    taskScores: { taskTitle: string; averageScore: number | null }[];
    overallAverage: number | null;
    groupUrl: string;
    threadMessageId?: string;
    lang?: Language;
  }): Promise<string | null> {
    const { toEmail, groupName, taskScores, overallAverage, groupUrl, threadMessageId, lang } = params;
    const vi = lang !== Language.EN;
    const scoreLabel = overallAverage !== null ? `${overallAverage}/10` : '—';
    const taskRowsHtml = taskScores
      .map(
        (t) =>
          vi
            ? `<tr><td>${t.taskTitle}</td><td>${t.averageScore !== null ? `${t.averageScore}/10` : '—'}</td></tr>`
            : `<tr><td>${t.taskTitle}</td><td>${t.averageScore !== null ? `${t.averageScore}/10` : '—'}</td></tr>`,
      )
      .join('');
    const taskRowsText = taskScores
      .map(
        (t) =>
          vi
            ? `- ${t.taskTitle}: ${t.averageScore !== null ? `${t.averageScore}/10` : '—'}`
            : `- ${t.taskTitle}: ${t.averageScore !== null ? `${t.averageScore}/10` : '—'}`,
      )
      .join('\n');
    return this.send({
      to: toEmail,
      subject: vi
        ? `Kết quả đánh giá đóng góp: ${groupName}`
        : `Peer evaluation results: ${groupName}`,
      html: vi
        ? `
        <h2>Vòng đánh giá đã kết thúc</h2>
        <p>Vòng đánh giá đóng góp cho nhóm <strong>${groupName}</strong> đã kết thúc.</p>
        <h3>Điểm của bạn:</h3>
        <table border="1" cellpadding="6" cellspacing="0">
          <tr><th>Nhiệm vụ</th><th>Điểm trung bình</th></tr>
          ${taskRowsHtml}
        </table>
        <p><strong>Điểm tổng: ${scoreLabel}</strong></p>
        <p><a href="${groupUrl}">Đến nhóm</a></p>
      `
        : `
        <h2>Evaluation Round Closed</h2>
        <p>The peer evaluation round for group <strong>${groupName}</strong> has closed.</p>
        <h3>Your scores:</h3>
        <table border="1" cellpadding="6" cellspacing="0">
          <tr><th>Task</th><th>Average Score</th></tr>
          ${taskRowsHtml}
        </table>
        <p><strong>Overall score: ${scoreLabel}</strong></p>
        <p><a href="${groupUrl}">Go to group</a></p>
      `,
      text: vi
        ? `Vòng đánh giá đóng góp của nhóm "${groupName}" đã kết thúc.\n\nĐiểm của bạn:\n${taskRowsText}\n\nĐiểm tổng: ${scoreLabel}\n${groupUrl}`
        : `Peer evaluation for group "${groupName}" has closed.\n\nYour scores:\n${taskRowsText}\n\nOverall score: ${scoreLabel}\n${groupUrl}`,
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
    lang?: Language;
  }): Promise<string | null> {
    const { toEmail, groupName, tasks, groupUrl, threadMessageId, lang } =
      params;
    const vi = lang !== Language.EN;
    const taskRows = tasks
      .map(
        (t) =>
          vi
            ? `<li><strong>${t.title}</strong> — hạn ${t.dueDate.toLocaleString()}</li>`
            : `<li><strong>${t.title}</strong> — due ${t.dueDate.toLocaleString()}</li>`,
      )
      .join('');
    return this.send({
      to: toEmail,
      subject: vi
        ? `Nhắc nhở nhiệm vụ quá hạn: ${groupName}`
        : `Overdue task reminder: ${groupName}`,
      html: vi
        ? `
        <h2>Nhiệm vụ quá hạn — ${groupName}</h2>
        <p>Các nhiệm vụ sau đây đã quá hạn:</p>
        <ul>${taskRows}</ul>
        <p>Vui lòng hoàn thành sớm nhất có thể.</p>
        <p><a href="${groupUrl}">Xem nhiệm vụ nhóm</a></p>
      `
        : `
        <h2>Overdue Tasks — ${groupName}</h2>
        <p>The following tasks are overdue:</p>
        <ul>${taskRows}</ul>
        <p>Please complete them as soon as possible.</p>
        <p><a href="${groupUrl}">Open group tasks</a></p>
      `,
      text: vi
        ? `Nhiệm vụ quá hạn trong ${groupName}:\n` +
          tasks
            .map((t) => `- ${t.title} (hạn ${t.dueDate.toLocaleString()})`)
            .join('\n') +
          `\n${groupUrl}`
        : `Overdue tasks in ${groupName}:\n` +
          tasks
            .map((t) => `- ${t.title} (due ${t.dueDate.toLocaleString()})`)
            .join('\n') +
          `\n${groupUrl}`,
      inReplyTo: threadMessageId,
    });
  }
}
