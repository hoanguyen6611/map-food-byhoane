'use client';

import { useState, type ReactNode } from 'react';

export type ProfileTabKey = 'reviews' | 'contributed' | 'photos' | 'saved';

interface Tab {
  key: ProfileTabKey;
  label: string;
  count: number;
  content: ReactNode;
}

interface Props {
  tabs: Tab[];
}

/**
 * Local client-side state, not URL-driven — every tab's data is already
 * fetched up front by the server component (profile/page.tsx), so switching
 * tabs is instant with no extra round-trip.
 */
export function ProfileTabs({ tabs }: Props) {
  const [active, setActive] = useState<ProfileTabKey>(tabs[0]?.key ?? 'reviews');
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      {/* `.tab-segment`/`.tab-segment-btn` — same segmented-control look as
          the restaurant detail page's Thông tin/Đánh giá tabs and the
          redesign's `pTabs` (no visible count pill there, unlike the old
          `.notification-tab` look this replaced; the count still reaches
          assistive tech via aria-label). */}
      <div className="tab-segment profile-tab-segment">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab-segment-btn ${active === tab.key ? 'tab-segment-btn-active' : ''}`}
            aria-label={`${tab.label} (${tab.count})`}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="profile-tab-panel">{activeTab?.content}</div>
    </div>
  );
}
