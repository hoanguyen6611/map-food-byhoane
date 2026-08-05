import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import type { CrowdedLevel, PowerOutletLevel, SeatAvailabilityLevel } from '@foodmap/shared-types';

const STATUS_REPORT_KINDS = ['crowded', 'seat', 'outlet', 'parking', 'hours_change', 'moved', 'wrong_info', 'closure'] as const;
export type StatusReportKind = (typeof STATUS_REPORT_KINDS)[number];

const CROWDED_LEVELS: CrowdedLevel[] = ['empty', 'light', 'moderate', 'crowded', 'full'];
const SEAT_LEVELS: SeatAvailabilityLevel[] = ['plenty', 'limited', 'full'];
const OUTLET_LEVELS: PowerOutletLevel[] = ['plenty', 'some', 'none'];

// A single class validating a discriminated union by `kind` — class-validator
// has no native discriminated-union support, so each field's validation is
// conditioned on `kind` via @ValidateIf. See StatusReportRequest in
// shared-types for the clean discriminated-union type this deserializes to.
export class CreateStatusReportDto {
  @IsIn(STATUS_REPORT_KINDS)
  kind!: StatusReportKind;

  @ValidateIf((o: CreateStatusReportDto) => o.kind === 'crowded')
  @IsIn(CROWDED_LEVELS)
  crowdedLevel?: CrowdedLevel;

  @ValidateIf((o: CreateStatusReportDto) => o.kind === 'seat')
  @IsIn(SEAT_LEVELS)
  seatLevel?: SeatAvailabilityLevel;

  @ValidateIf((o: CreateStatusReportDto) => o.kind === 'outlet')
  @IsIn(OUTLET_LEVELS)
  outletLevel?: PowerOutletLevel;

  @ValidateIf((o: CreateStatusReportDto) => o.kind === 'parking')
  @IsBoolean()
  hasCarParking?: boolean;

  @ValidateIf((o: CreateStatusReportDto) => o.kind === 'parking')
  @IsBoolean()
  hasMotorbikeParking?: boolean;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @ValidateIf((o: CreateStatusReportDto) => o.kind === 'hours_change' || o.kind === 'moved' || o.kind === 'wrong_info')
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
