import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroupEmailThread } from '@common/entities/group-email-thread.entity';

@Injectable()
export class GroupEmailThreadService {
  private readonly logger = new Logger(GroupEmailThreadService.name);

  constructor(
    @InjectRepository(GroupEmailThread)
    private readonly threadsRepository: Repository<GroupEmailThread>,
  ) {}

  findByGroupAndUser(
    groupId: string,
    userId: string,
  ): Promise<GroupEmailThread | null> {
    return this.threadsRepository.findOne({
      where: { group_id: groupId, user_id: userId },
    });
  }

  async create(
    groupId: string,
    userId: string,
    messageId: string,
  ): Promise<GroupEmailThread> {
    this.logger.log(`Creating email thread for group ${groupId} user ${userId}`);
    const thread = this.threadsRepository.create({
      group_id: groupId,
      user_id: userId,
      thread_message_id: messageId,
    });
    return this.threadsRepository.save(thread);
  }
}
