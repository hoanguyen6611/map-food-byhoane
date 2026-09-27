import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getLeaderboard } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { initialsOf } from '@/lib/format';
import { StarIcon } from '@/components/icons';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'leaderboard' });
  return { title: t('title'), alternates: { canonical: '/leaderboard' } };
}

// Public — no login required, same visibility rule as a public profile
// (UserProfile.isPublic gates who's even eligible to appear server-side, see
// GamificationService.getLeaderboard).
export default async function LeaderboardPage() {
  const [t, { items }] = await Promise.all([getTranslations('leaderboard'), getLeaderboard()]);

  return (
    <div className="container page-sections" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>
            {t('title')}
          </h1>
          <p className="page-header-sub">{t('subtitle')}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">{t('empty')}</p>
        </div>
      ) : (
        <div className="leaderboard-list">
          {items.map((entry) => (
            <Link key={entry.userId} href={`/profile/${entry.userId}`} className="leaderboard-row">
              <span className="leaderboard-rank">{entry.rank}</span>
              <span className="leaderboard-avatar">
                {entry.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external ImageKit/S3 URL
                  <img src={entry.avatarUrl} alt="" />
                ) : (
                  initialsOf(entry.displayName)
                )}
              </span>
              <span className="leaderboard-body">
                <span className="leaderboard-name">{entry.displayName}</span>
                <span className="leaderboard-points">
                  <StarIcon size={11} filled /> {t('levelBadge', { level: entry.level })} · {t('pointsLabel', { points: entry.points })}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
