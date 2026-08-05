import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ModerationDecisionDto {
  @IsIn(['approved', 'rejected', 'edit_requested'])
  decision!: 'approved' | 'rejected' | 'edit_requested';

  // Required unless decision === 'approved' — enforced in the service
  // (class-validator's @ValidateIf needs the sibling field, done there for
  // a clearer error message than a generic conditional-validation one).
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
