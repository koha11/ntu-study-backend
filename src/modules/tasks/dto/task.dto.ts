import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { TaskStatus } from '@common/enums';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  group_id?: string;

  @IsUUID()
  @IsOptional()
  assignee_id?: string;

  @IsOptional()
  due_date?: Date;

  @IsUUID()
  @IsOptional()
  parent_task_id?: string;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsUUID()
  @IsOptional()
  assignee_id?: string;

  @IsOptional()
  due_date?: Date;
}

export class SubmitTaskDto {
  @IsString()
  @IsOptional()
  comment?: string;
}

export class ApproveTaskDto {
  @IsEnum(TaskStatus)
  @IsNotEmpty()
  status!: TaskStatus;

  @IsString()
  @IsOptional()
  comment?: string;
}
