import { Module } from '@nestjs/common';
import { ClaudeGatewayService } from './claude-gateway.service';
import { AiSummaryService } from './ai-summary.service';

// The real AIGateway implementation (Claude adapter, per
// docs/05-system-architecture.md §4) — ClaudeGatewayService is consumed by
// ReviewModerationService and ContributionModerationService (moderation)
// and AiSummaryService (AI Summary), each in their own module.
@Module({
  providers: [ClaudeGatewayService, AiSummaryService],
  exports: [ClaudeGatewayService, AiSummaryService],
})
export class AiModule {}
