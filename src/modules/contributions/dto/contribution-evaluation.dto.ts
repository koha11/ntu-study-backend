import { IsDateString, IsInt, Max, Min } from 'class-validator';

export class OpenEvaluationDto {
  @IsDateString()
  due_date!: string;
}

export class SubmitRatingDto {
  @IsInt()
  @Min(0)
  @Max(10)
  score!: number;
}
