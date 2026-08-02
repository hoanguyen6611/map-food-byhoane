import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  // Per docs/01-prd-mvp.md §10.1 validation rule: >=8 chars including 1 digit.
  @MinLength(8)
  @Matches(/\d/, { message: 'password must contain at least one number' })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;
}
