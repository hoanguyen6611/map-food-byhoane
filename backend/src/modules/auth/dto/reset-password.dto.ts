import { IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @MinLength(8)
  @Matches(/\d/, { message: 'newPassword must contain at least one number' })
  newPassword!: string;
}
