import { Injectable } from '@nestjs/common';
import type { Contribution } from '@prisma/client';
import type { ContributionStatus } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { assertDecisionAllowed } from '../moderation/moderation-decision.util';
import type { ModerationCheckResult } from '../review/review-moderation.service';

interface StatusReportPayload {
  kind: 'crowded' | 'seat' | 'outlet' | 'parking' | 'hours_change' | 'moved' | 'wrong_info';
  crowdedLevel?: string;
  seatLevel?: string;
  outletLevel?: string;
  hasCarParking?: boolean;
  hasMotorbikeParking?: boolean;
  isFree?: boolean;
  notes?: string;
}

interface EditSuggestionPayload {
  fieldName: string;
  newValue: unknown;
}

/**
 * The single dispatcher for "what does approving a Contribution actually
 * do" — used both by the auto-finalize path (right after creation, no
 * moderator involved) and the Admin Moderation Queue's decision endpoint
 * (Phase 5), so the side-effect logic for each Contribution.type lives in
 * exactly one place.
 */
@Injectable()
export class ContributionFinalizeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurantService: RestaurantService,
  ) {}

  /** Called immediately after a Contribution + its ModerationResult are created (no moderator involved yet). */
  async finalizeAfterModeration(contributionId: string, moderation: ModerationCheckResult): Promise<ContributionStatus> {
    const contribution = await this.prisma.contribution.findUniqueOrThrow({ where: { id: contributionId } });

    if (moderation.recommendedAction === 'auto_approve') {
      await this.prisma.contribution.update({ where: { id: contributionId }, data: { status: 'auto_approved' } });
      await this.applySideEffect(contribution);
      return 'auto_approved';
    }

    await this.prisma.contribution.update({ where: { id: contributionId }, data: { status: 'in_review' } });
    if (contribution.type === 'new_restaurant' && contribution.targetRestaurantId) {
      await this.prisma.restaurantStatus.update({
        where: { restaurantId: contribution.targetRestaurantId },
        data: { publicationStatus: 'in_review' },
      });
    }
    return 'in_review';
  }

  /** Called from the Admin Moderation Queue's decision endpoint (Phase 5) — a real moderator is always the actor here. */
  async applyModeratorDecision(
    contributionId: string,
    moderationResult: { recommendedAction: 'auto_approve' | 'hold_for_review' | 'reject'; riskScore: number },
    decision: 'approved' | 'rejected' | 'edit_requested',
    decidedBy: string,
  ): Promise<void> {
    assertDecisionAllowed(moderationResult, decision, decidedBy);

    const contribution = await this.prisma.contribution.findUniqueOrThrow({ where: { id: contributionId } });
    await this.prisma.contribution.update({ where: { id: contributionId }, data: { status: decision } });

    if (decision === 'approved') {
      await this.applySideEffect(contribution);
      return;
    }
    if (decision === 'rejected' && contribution.type === 'new_restaurant' && contribution.targetRestaurantId) {
      await this.prisma.restaurantStatus.update({
        where: { restaurantId: contribution.targetRestaurantId },
        data: { publicationStatus: 'rejected' },
      });
    }
    // edit_requested never mutates the live entity — the contributor resubmits.
  }

  private async applySideEffect(contribution: Contribution): Promise<void> {
    switch (contribution.type) {
      case 'new_restaurant': {
        if (!contribution.targetRestaurantId) return;
        await this.prisma.restaurantStatus.update({
          where: { restaurantId: contribution.targetRestaurantId },
          data: { publicationStatus: 'published' },
        });
        await this.restaurantService.invalidateViewportCache();
        return;
      }
      case 'edit_suggestion': {
        if (!contribution.targetRestaurantId) return;
        const payload = contribution.payload as unknown as EditSuggestionPayload;
        await this.applyEditSuggestionField(contribution.targetRestaurantId, payload.fieldName, payload.newValue);
        await this.restaurantService.invalidateViewportCache();
        return;
      }
      case 'status_update': {
        if (!contribution.targetRestaurantId) return;
        await this.applyStatusReport(contribution.targetRestaurantId, contribution.userId, contribution.payload as unknown as StatusReportPayload);
        return;
      }
      case 'closure_report':
        // Never auto-applies to the live restaurant — informational only,
        // surfaced via the moderation queue / closure-escalation logic.
        return;
    }
  }

  private async applyStatusReport(restaurantId: string, userId: string, payload: StatusReportPayload): Promise<void> {
    const reportedAt = new Date();
    switch (payload.kind) {
      case 'crowded':
        await this.prisma.crowdedStatus.create({
          data: { restaurantId, level: payload.crowdedLevel as never, reportedBy: userId, reportedAt },
        });
        return;
      case 'seat':
        await this.prisma.seatAvailability.create({
          data: { restaurantId, level: payload.seatLevel as never, reportedBy: userId, reportedAt },
        });
        return;
      case 'outlet':
        await this.prisma.powerOutletStatus.create({
          data: { restaurantId, level: payload.outletLevel as never, reportedBy: userId, reportedAt },
        });
        return;
      case 'parking':
        await this.prisma.parkingInformation.upsert({
          where: { restaurantId },
          create: {
            restaurantId,
            hasCarParking: payload.hasCarParking ?? false,
            hasMotorbikeParking: payload.hasMotorbikeParking ?? false,
            isFree: payload.isFree,
            notes: payload.notes,
            lastUpdatedBy: userId,
            lastUpdatedAt: reportedAt,
          },
          update: {
            hasCarParking: payload.hasCarParking ?? false,
            hasMotorbikeParking: payload.hasMotorbikeParking ?? false,
            isFree: payload.isFree,
            notes: payload.notes,
            lastUpdatedBy: userId,
            lastUpdatedAt: reportedAt,
          },
        });
        return;
      case 'hours_change':
      case 'moved':
      case 'wrong_info':
        // Never auto-applies — informational only, per build-prompts/07.
        return;
    }
  }

  private async applyEditSuggestionField(restaurantId: string, fieldName: string, newValue: unknown): Promise<void> {
    switch (fieldName) {
      case 'name':
      case 'description':
      case 'phone':
        await this.prisma.restaurant.update({ where: { id: restaurantId }, data: { [fieldName]: newValue } });
        return;
      case 'address.line':
      case 'address.ward':
      case 'address.district':
      case 'address.province': {
        const restaurant = await this.prisma.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
        const field = fieldName.split('.')[1];
        const updated = await this.prisma.address.update({
          where: { id: restaurant.addressId },
          data: { [field]: newValue },
        });
        await this.prisma.address.update({
          where: { id: restaurant.addressId },
          data: {
            fullAddressText: [updated.line, updated.ward, updated.district, updated.province].filter(Boolean).join(', '),
          },
        });
        return;
      }
      case 'openingHours': {
        const days = newValue as { dayOfWeek: number; openTime: string | null; closeTime: string | null; isClosed: boolean }[];
        await this.prisma.$transaction([
          this.prisma.openingHour.deleteMany({ where: { restaurantId } }),
          this.prisma.openingHour.createMany({
            data: days.map((day) => ({
              restaurantId,
              dayOfWeek: day.dayOfWeek,
              openTime: day.isClosed || !day.openTime ? null : this.parseTime(day.openTime),
              closeTime: day.isClosed || !day.closeTime ? null : this.parseTime(day.closeTime),
              isClosed: day.isClosed,
            })),
          }),
        ]);
        return;
      }
      case 'facilities': {
        const facilities = newValue as string[];
        await this.prisma.$transaction([
          this.prisma.restaurantFacility.deleteMany({ where: { restaurantId } }),
          ...(facilities.length > 0
            ? [
                this.prisma.restaurantFacility.createMany({
                  data: facilities.map((facilityType) => ({ restaurantId, facilityType: facilityType as never })),
                }),
              ]
            : []),
        ]);
        return;
      }
    }
  }

  private parseTime(hhmm: string): Date {
    const [hour, minute] = hhmm.split(':').map(Number);
    return new Date(Date.UTC(1970, 0, 1, hour, minute));
  }
}
