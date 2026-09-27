-- Adds the "owner_claim" contribution type: a self-service request from a
-- logged-in user to become the verified owner of an existing restaurant,
-- reviewed through the same moderation queue as every other contribution
-- type. See ContributionService.createOwnerClaim /
-- ContributionFinalizeService's 'owner_claim' applySideEffect case.
ALTER TYPE "ContributionType" ADD VALUE 'owner_claim';
