export type PushPlatform = 'ios' | 'android';

export interface RegisterPushTokenDto {
  token: string;
  platform: PushPlatform;
}
