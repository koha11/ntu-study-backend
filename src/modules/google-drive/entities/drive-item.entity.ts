import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { DriveItemType } from '@common/enums';
import { BaseEntity } from '@common/entities/base.entity';
import { Group } from '@modules/groups/entities/group.entity';

@Entity('drive_items')
@Index(['group_id'])
@Index(['drive_file_id'])
@Index(['parent_drive_id'])
@Index(['mime_type'])
export class DriveItem extends BaseEntity {
  @ManyToOne(() => Group, (group) => group.drive_items, { onDelete: 'CASCADE' })
  group!: Group;

  @Column({ type: 'uuid' })
  group_id!: string;

  @Column({ type: 'varchar', length: 255 })
  drive_file_id!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  parent_drive_id?: string;

  @Column({ type: 'varchar', length: 255 })
  mime_type!: string;

  @Column({ type: 'enum', enum: DriveItemType })
  type!: DriveItemType;

  @Column({ type: 'text', nullable: true })
  web_view_link?: string;

  @Column({ type: 'bigint' })
  file_size!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name?: string;
}
