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

    // Verify connection
    this.transporter.verify((err) => {
      if (err) {
        this.logger.warn(`Email service connection failed: ${err.message}`);
      } else {
        this.logger.log(`Email service ready at ${mailHost}:${mailPort}`);
      }
    });
  }

  async send(options: EmailOptions): Promise<boolean> {
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
}
