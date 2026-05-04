import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateFlashcardSetDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateFlashcardDto {
  @IsString()
  @IsNotEmpty()
  front!: string;

  @IsString()
  @IsNotEmpty()
  back!: string;
}

export class CompleteStudyDto {
  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;
}

export class UpdateFlashcardSetDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  subject?: string | null;

  @IsString()
  @IsOptional()
  description?: string | null;
}

export class UpdateFlashcardDto {
  @IsString()
  @IsOptional()
  front?: string;

  @IsString()
  @IsOptional()
  back?: string;
}
