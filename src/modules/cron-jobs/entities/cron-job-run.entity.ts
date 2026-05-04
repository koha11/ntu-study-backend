import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { CronJobRunStatus, CronJobTrigger } from '@common/enums';

@Entity('cron_job_runs')
@Index(['job_name'])
@Index(['started_at'])
export class CronJobRun extends BaseEntity {
  @Column({ type: 'varchar', length: 128 })
  job_name!: string;

  @Column({ type: 'timestamptz' })
  started_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finished_at!: Date | null;

  @Column({ type: 'enum', enum: CronJobRunStatus })
  status!: CronJobRunStatus;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @Column({ type: 'enum', enum: CronJobTrigger })
  triggered_by!: CronJobTrigger;
}
