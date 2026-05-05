import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'dns';
import * as net from 'net';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function verifySmtp(transporter: Transporter): Promise<Error | null> {
  return new Promise((resolve) => {
    transporter.verify((err) => resolve(err ?? null));
  });
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: Transporter;
  private readonly ready: Promise<void>;

  constructor(private configService: ConfigService) {
    this.ready = this.initializeTransporter();
  }

  async onModuleInit() {
    await this.ready;
  }

  private async initializeTransporter(): Promise<void> {
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

    const auth = { user: mailUser, pass: mailPassword };

    // Nodemailer picks a random A/AAAA address; IPv6 is often unreachable from cloud
    // hosts (e.g. Render → ENETUNREACH). Prefer IPv4 for remote SMTP hostnames.
    const skipIpv4Resolve =
      mailHost === 'localhost' ||
      mailHost === '127.0.0.1' ||
      net.isIP(mailHost) !== 0;

    let ipv4List: string[] = [];
    if (!skipIpv4Resolve) {
      try {
        ipv4List = await dns.promises.resolve4(mailHost);
      } catch {
        ipv4List = [];
      }
    }

    const candidates: Array<{ host: string; servername?: string }> =
      ipv4List.length > 0
        ? shuffleArray(ipv4List).map((ip) => ({
            host: ip,
            servername: mailHost,
          }))
        : [{ host: mailHost }];

    const primaryPort = Number(mailPort);
    const portStrategies: Array<{
      port: number;
      secure: boolean;
      requireTLS: boolean;
    }> = [
      {
        port: primaryPort,
        secure: primaryPort === 465,
        requireTLS: primaryPort === 587,
      },
    ];
    // Some hosts block or flake on implicit TLS (465); Gmail also serves STARTTLS on 587.
    if (primaryPort === 465) {
      portStrategies.push({
        port: 587,
        secure: false,
        requireTLS: true,
      });
    }

    let lastError: Error | null = null;

    for (const strategy of portStrategies) {
      for (const cand of candidates) {
        const transporter = nodemailer.createTransport({
          host: cand.host,
          port: strategy.port,
          secure: strategy.secure,
          requireTLS: strategy.requireTLS,
          connectionTimeout: 20_000,
          greetingTimeout: 15_000,
          auth,
          ...(cand.servername
            ? {
                servername: cand.servername,
                tls: {
                  servername: cand.servername,
                  minVersion: 'TLSv1.2' as const,
                },
              }
            : {}),
        });

        const err = await verifySmtp(transporter);
        if (!err) {
          this.transporter = transporter;
          const via =
            cand.servername && cand.host !== mailHost
              ? ` (via ${cand.host})`
              : '';
          this.logger.log(
            `Email service ready at ${mailHost}:${strategy.port}${via}`,
          );
          return;
        }

        lastError = err;
        transporter.close();
      }
    }

    const fallback = nodemailer.createTransport({
      host: candidates[0].host,
      port: portStrategies[0].port,
      secure: portStrategies[0].secure,
      requireTLS: portStrategies[0].requireTLS,
      connectionTimeout: 20_000,
      greetingTimeout: 15_000,
      auth,
      ...(candidates[0].servername
        ? {
            servername: candidates[0].servername,
            tls: {
              servername: candidates[0].servername,
              minVersion: 'TLSv1.2' as const,
            },
          }
        : {}),
    });

    this.transporter = fallback;
    this.logger.warn(
      `Email service connection failed: ${lastError?.message ?? 'verify failed'}` +
        (primaryPort === 465
          ? ' — set MAIL_PORT=587 on your host if implicit TLS (465) is blocked.'
          : ''),
    );
  }

  async send(options: EmailOptions): Promise<boolean> {
    await this.ready;
    try {
      const mailFrom = this.configService.get<string>(
        'MAIL_FROM',
        'noreply@ntu-study.local',
      );

      const mailOptions = {
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

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent: ${info.messageId} to ${options.to}`);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send email to ${options.to}: ${errorMessage}`,
      );
      return false;
    }
  }

  async sendTaskReminder(
    userEmail: string,
    taskName: string,
    dueDate: Date,
  ): Promise<boolean> {
    return this.send({
      to: userEmail,
      subject: `Task Reminder: ${taskName}`,
      html: `
        <h2>Task Reminder</h2>
        <p>You have an overdue task:</p>
        <p><strong>${taskName}</strong></p>
        <p>Due date: ${dueDate.toLocaleString()}</p>
        <p>Please complete this task as soon as possible.</p>
      `,
      text: `Task Reminder: ${taskName}\nDue date: ${dueDate.toLocaleString()}`,
    });
  }

  async sendGroupInvitation(
    userEmail: string,
    inviterName: string,
    groupName: string,
    invitationLink: string,
  ): Promise<boolean> {
    return this.send({
      to: userEmail,
      subject: `You're invited to join ${groupName}`,
      html: `
        <h2>Group Invitation</h2>
        <p>${inviterName} has invited you to join the study group <strong>${groupName}</strong>.</p>
        <p><a href="${invitationLink}">Accept Invitation</a></p>
      `,
      text: `You're invited to join ${groupName}.\nAccept here: ${invitationLink}`,
    });
  }

  async sendNotification(
    userEmail: string,
    title: string,
    message: string,
  ): Promise<boolean> {
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
  }): Promise<boolean> {
    const { toEmail, taskTitle, groupName, taskUrl } = params;
    return this.send({
      to: toEmail,
      subject: `New task assigned: ${taskTitle}`,
      html: `
        <h2>You were assigned a task</h2>
        <p>You have been assigned <strong>${taskTitle}</strong> in <strong>${groupName}</strong>.</p>
        <p><a href="${taskUrl}">Open group tasks</a></p>
      `,
      text: `You were assigned "${taskTitle}" in ${groupName}.\n${taskUrl}`,
    });
  }

  async sendTaskPendingReviewEmail(params: {
    toEmail: string;
    taskTitle: string;
    groupName: string;
    submitterName: string;
    taskUrl: string;
  }): Promise<boolean> {
    const { toEmail, taskTitle, groupName, submitterName, taskUrl } = params;
    return this.send({
      to: toEmail,
      subject: `Task ready for review: ${taskTitle}`,
      html: `
        <h2>Task submitted for review</h2>
        <p><strong>${submitterName}</strong> submitted <strong>${taskTitle}</strong> in <strong>${groupName}</strong> for your review.</p>
        <p><a href="${taskUrl}">Open group tasks</a></p>
      `,
      text: `${submitterName} submitted "${taskTitle}" in ${groupName} for review.\n${taskUrl}`,
    });
  }

  async sendTaskReviewResultEmail(params: {
    toEmail: string;
    taskTitle: string;
    groupName: string;
    outcome: 'done' | 'failed';
    taskUrl: string;
  }): Promise<boolean> {
    const { toEmail, taskTitle, groupName, outcome, taskUrl } = params;
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
    });
  }
}
