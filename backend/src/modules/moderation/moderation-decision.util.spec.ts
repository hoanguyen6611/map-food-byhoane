import { assertDecisionAllowed } from './moderation-decision.util';

// This is the actual proof of the Definition of Done's "hard rule": AI (or
// a rule-based stand-in) can never self-approve high-risk content.
// `recommendedAction: 'reject'` never comes from the rule-based stand-ins
// today (they only ever return auto_approve/hold_for_review) — this test
// simulates a hypothetical future AI response to prove the guard works
// independent of whatever currently produces recommendations.
describe('assertDecisionAllowed', () => {
  it('throws when approving a reject-recommended result without a real moderator', () => {
    expect(() =>
      assertDecisionAllowed(
        { recommendedAction: 'reject', riskScore: 0.9 },
        'approved',
        null,
      ),
    ).toThrow();
  });

  it('throws when approving a high-risk-scored result without a real moderator, even if recommendedAction is not reject', () => {
    expect(() =>
      assertDecisionAllowed(
        { recommendedAction: 'hold_for_review', riskScore: 0.75 },
        'approved',
        null,
      ),
    ).toThrow();
  });

  it('allows a real moderator to approve high-risk content (human override)', () => {
    expect(() =>
      assertDecisionAllowed(
        { recommendedAction: 'reject', riskScore: 0.9 },
        'approved',
        'moderator-user-id',
      ),
    ).not.toThrow();
  });

  it('allows the legitimate auto-approve path (low risk, no decider) through', () => {
    expect(() =>
      assertDecisionAllowed(
        { recommendedAction: 'auto_approve', riskScore: 0.1 },
        'approved',
        null,
      ),
    ).not.toThrow();
  });

  it('never blocks non-approved decisions regardless of risk or decider', () => {
    expect(() =>
      assertDecisionAllowed(
        { recommendedAction: 'reject', riskScore: 0.95 },
        'rejected',
        null,
      ),
    ).not.toThrow();
    expect(() =>
      assertDecisionAllowed(
        { recommendedAction: 'reject', riskScore: 0.95 },
        'edit_requested',
        null,
      ),
    ).not.toThrow();
  });
});
