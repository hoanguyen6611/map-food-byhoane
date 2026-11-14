import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';

export class WebPushKeysDto {
  @IsString()
  @MaxLength(200)
  p256dh!: string;

  @IsString()
  @MaxLength(100)
  auth!: string;
}

/** Shape of the browser's `PushSubscription.toJSON()` (minus expirationTime). */
export class RegisterWebPushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true })
  @MaxLength(1000)
  endpoint!: string;

  @ValidateNested()
  @Type(() => WebPushKeysDto)
  keys!: WebPushKeysDto;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  userAgent?: string;
}

export class RemoveWebPushSubscriptionDto {
  @IsString()
  @MaxLength(1000)
  endpoint!: string;
}
