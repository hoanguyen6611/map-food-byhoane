'use client';

import { useState, type ReactNode } from 'react';

export type ProfileTabKey = 'reviews' | 'saved' | 'photos' | 'settings';

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
      <div className="notification-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`notification-tab ${active === tab.key ? 'notification-tab-active' : ''}`}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
            <span className="notification-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>
      <div className="profile-tab-panel">{activeTab?.content}</div>
    </div>
  );
}
