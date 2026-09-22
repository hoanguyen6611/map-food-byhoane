import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReviewReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body!: string;
}
