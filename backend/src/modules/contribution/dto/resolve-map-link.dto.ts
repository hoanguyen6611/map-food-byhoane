import { IsString, IsNotEmpty } from 'class-validator';

export class ResolveMapLinkDto {
  @IsString()
  @IsNotEmpty()
  url!: string;
}
