import {
  MEDIUM_RISK_THRESHOLD,
  recommendActionForRiskScore,
  scoreTextContentRuleBased,
} from './rule-based-moderation.util';

describe('recommendActionForRiskScore', () => {
  it('recommends auto_approve below the medium-risk threshold', () => {
    expect(recommendActionForRiskScore(MEDIUM_RISK_THRESHOLD - 0.01)).toBe('auto_approve');
  });

  it('recommends hold_for_review at or above the medium-risk threshold', () => {
    expect(recommendActionForRiskScore(MEDIUM_RISK_THRESHOLD)).toBe('hold_for_review');
    expect(recommendActionForRiskScore(1)).toBe('hold_for_review');
  });
});

describe('scoreTextContentRuleBased', () => {
  it('scores clean text as zero risk with no labels', () => {
    const result = scoreTextContentRuleBased('Quán này rất ngon, phục vụ nhiệt tình.');
    expect(result.riskScore).toBe(0);
    expect(result.labels).toEqual([]);
  });

  it('treats null content the same as empty text', () => {
    const result = scoreTextContentRuleBased(null);
    expect(result.riskScore).toBe(0);
    expect(result.labels).toEqual([]);
  });

  it('flags a URL', () => {
    const result = scoreTextContentRuleBased('Ghé xem thêm tại https://spam.example.com nhé');
    expect(result.labels).toContain('contains_url');
    expect(result.riskScore).toBeGreaterThan(0);
  });

  it('flags a known spam phrase', () => {
    const result = scoreTextContentRuleBased('Kiếm tiền online dễ dàng, inbox zalo ngay');
    expect(result.labels).toContain('spam_phrase');
  });

  it('flags all-caps text past the length threshold', () => {
    const result = scoreTextContentRuleBased('QUAN NAY THUC SU RAT LA TUYET VOI CHO MOI NGUOI GHE THAM NHE');
    expect(result.labels).toContain('all_caps');
  });

  it('flags repeated characters', () => {
    const result = scoreTextContentRuleBased('ngonnnnn quaaaaa');
    expect(result.labels).toContain('repeated_chars');
  });

  it('accumulates multiple signals and clamps at 1.0', () => {
    const result = scoreTextContentRuleBased('CLICK VAO LINK https://x.com KIEM TIEN ONLINE NGAYYYYY');
    expect(result.riskScore).toBeLessThanOrEqual(1);
    expect(result.labels.length).toBeGreaterThan(1);
  });

  it('marks the reason as rule-based so it is distinguishable from a real Claude judgment', () => {
    const result = scoreTextContentRuleBased(null);
    expect(result.reason).toContain('rule-based');
  });
});
