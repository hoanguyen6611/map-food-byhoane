import { Module } from '@nestjs/common';
import { WebRevalidationService } from './web-revalidation.service';

@Module({
  providers: [WebRevalidationService],
  exports: [WebRevalidationService],
})
export class RevalidationModule {}
