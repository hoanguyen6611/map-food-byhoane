import { IsIn } from 'class-validator';

export class ResolveReportDto {
  @IsIn(['resolved', 'dismissed'])
  status!: 'resolved' | 'dismissed';
}
