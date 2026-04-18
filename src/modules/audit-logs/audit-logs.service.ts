import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog) private auditRepository: Repository<AuditLog>,
  ) {}

  async log(_logData: Partial<AuditLog>): Promise<AuditLog> {
    // TODO: Create audit log entry
    throw new Error('Not implemented');
  }

  async findGroupLogs(
    _groupId: string,
    _limit: number = 50,
  ): Promise<AuditLog[]> {
    // TODO: Find audit logs for group
    return [];
  }
}
