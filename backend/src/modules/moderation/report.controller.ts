import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ReportDto } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  create(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: RequestUser,
  ): Promise<ReportDto> {
    return this.reportService.create(dto, user.id);
  }
}
