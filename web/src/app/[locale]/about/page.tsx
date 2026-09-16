import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { searchRestaurants } from '@/lib/api';
import { Link } from '@/i18n/navigation';

// The 7 review-criteria codes actually rated (packages/shared-types/src/review.ts's
// ReviewCriteriaCode) — kept in sync by hand since there's no shared label
// source for this app-level description (the backend's own `label` field on
// ReviewCriteriaBreakdownDto is a fixed, non-locale-aware string).
const AXIS_CODES = ['food_quality', 'space', 'price', 'service', 'hygiene', 'wifi', 'parking'] as const;

// Real backend constant (backend/src/modules/review/composite-score.util.ts's
// MIN_VOTES_THRESHOLD) — cited here as an actual fact about how scoring
// works, not invented for the page.
const MIN_VOTES_THRESHOLD = 5;

const SECTIONS = ['cach-cham-diem', 'tieu-chi', 'kiem-duyet', 'du-lieu'] as const;
type Section = (typeof SECTIONS)[number];

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ section?: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });
  return { title: t('pageTitle') };
}

export default async function AboutPage({ searchParams }: PageProps) {
  const { section: sectionParam } = await searchParams;
  const section: Section = SECTIONS.includes(sectionParam as Section) ? (sectionParam as Section) : 'cach-cham-diem';

  const t = await getTranslations('about');
  const totalResult = await searchRestaurants({ pageSize: 1 });

  function sectionHref(target: Section): string {
    return target === 'cach-cham-diem' ? '/about' : `/about?section=${target}`;
  }

  return (
    <div className="container about-layout">
      <div className="about-nav">
        <span className="about-nav-eyebrow">{t('navEyebrow')}</span>
        {SECTIONS.map((s) => (
          <Link key={s} href={sectionHref(s)} className={`about-nav-item ${section === s ? 'about-nav-item-active' : ''}`}>
            {t(`nav.${s}`)}
          </Link>
        ))}
      </div>

      <div className="about-content">
        {section === 'cach-cham-diem' ? (
          <>
            <h1 className="about-section-title">{t('score.title')}</h1>
            <p className="about-section-body">{t('score.body')}</p>
            <div className="about-fact-grid">
              <div className="about-fact-card">
                <span className="about-fact-value font-num">{totalResult.total}</span>
                <span className="about-fact-label">{t('score.factRestaurants')}</span>
              </div>
              <div className="about-fact-card">
                <span className="about-fact-value font-num">{MIN_VOTES_THRESHOLD}</span>
                <span className="about-fact-label">{t('score.factThreshold')}</span>
              </div>
              <div className="about-fact-card">
                <span className="about-fact-value font-num">7</span>
                <span className="about-fact-label">{t('score.factCriteria')}</span>
              </div>
            </div>
            <div className="about-callout">
              <span className="about-callout-title">{t('score.calloutTitle')}</span>
              <span className="about-callout-body">{t('score.calloutBody')}</span>
            </div>
          </>
        ) : null}

        {section === 'tieu-chi' ? (
          <>
            <h1 className="about-section-title">{t('axes.title')}</h1>
            <p className="about-section-body">{t('axes.body')}</p>
            <div className="axis-doc-table">
              {AXIS_CODES.map((code) => (
                <div className="axis-doc-row" key={code}>
                  <span className="axis-doc-label">{t(`axes.items.${code}.label`)}</span>
                  <span className="axis-doc-note">{t(`axes.items.${code}.note`)}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {section === 'kiem-duyet' ? (
          <>
            <h1 className="about-section-title">{t('moderation.title')}</h1>
            <p className="about-section-body">{t('moderation.body')}</p>
            <div className="mod-step-list">
              {(['1', '2', '3'] as const).map((n) => (
                <div className="mod-step-card" key={n}>
                  <span className="mod-step-number">{n}</span>
                  <div className="mod-step-body">
                    <span className="mod-step-title">{t(`moderation.steps.${n}.title`)}</span>
                    <span className="mod-step-text">{t(`moderation.steps.${n}.body`)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {section === 'du-lieu' ? (
          <>
            <h1 className="about-section-title">{t('data.title')}</h1>
            <p className="about-section-body">{t('data.body')}</p>
            <div className="data-sources-card">
              <span className="data-sources-title">{t('data.sourcesTitle')}</span>
              <div className="data-sources-list">
                <p className="data-sources-item">
                  <strong>{t('data.source1Name')}</strong> — {t('data.source1Body')}
                </p>
                <p className="data-sources-item">
                  <strong>{t('data.source2Name')}</strong> — {t('data.source2Body')}
                </p>
              </div>
            </div>
            <div className="disclaimer-card">{t('data.disclaimer')}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}
