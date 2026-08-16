import { IsEnum, IsString, MaxLength } from 'class-validator';
import type { PushPlatform } from '@foodmap/shared-types';

const PUSH_PLATFORMS: PushPlatform[] = ['ios', 'android'];

export class RegisterPushTokenDto {
  @IsString()
  @MaxLength(200)
  token!: string;

  @IsEnum(PUSH_PLATFORMS)
  platform!: PushPlatform;
}
