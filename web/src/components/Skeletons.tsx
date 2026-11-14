// Route-level loading skeletons (rendered by each segment's loading.tsx while
// the server page streams in). Shapes roughly follow the real pages so the
// swap feels like content "filling in" rather than a layout jump. Shimmer
// styles: .skeleton-block/.skeleton-line in globals.css (reduced-motion aware).
import type { CSSProperties, ReactNode } from 'react';
import { useTranslations } from 'next-intl';

function Sk({ w = '100%', h = 14, r, className = '', style }: { w?: number | string; h?: number | string; r?: number | string; className?: string; style?: CSSProperties }) {
  return <div className={`skeleton-block ${className}`} style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

function Shell({ children, className = 'container page-sections', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const t = useTranslations('common');
  return (
    <div className={`${className} sk-shell`} style={style} role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('loading')}</span>
      {children}
    </div>
  );
}

function PageHeader({ sub = true }: { sub?: boolean }) {
  return (
    <div className="sk-header">
      <Sk w="46%" h={26} r={8} />
      {sub ? <Sk w="30%" h={14} /> : null}
    </div>
  );
}

function Chips({ count = 4 }: { count?: number }) {
  return (
    <div className="sk-chips">
      {Array.from({ length: count }, (_, i) => (
        <Sk key={i} w={i === 0 ? 72 : 88} h={34} r={999} />
      ))}
    </div>
  );
}

function Rows({ count = 6, avatar = false, thumb = 72 }: { count?: number; avatar?: boolean; thumb?: number }) {
  return (
    <div className="sk-rows">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="sk-row">
          <Sk w={avatar ? 44 : thumb} h={avatar ? 44 : thumb} r={avatar ? 999 : 12} style={{ flex: 'none' }} />
          <div className="sk-row-body">
            <Sk w={`${70 - (i % 3) * 12}%`} h={15} />
            <Sk w={`${45 - (i % 2) * 10}%`} h={12} />
            {!avatar ? <Sk w="30%" h={12} /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionHead() {
  return (
    <div className="sk-section-head">
      <Sk w="38%" h={20} r={6} />
      <Sk w={56} h={14} />
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <Shell className="container page-sections home-sections">
      <Sk h={150} r={20} className="sk-hero" />
      <section className="sk-section">
        <SectionHead />
        <div className="sk-cat-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="sk-cat">
              <Sk w={44} h={44} r={12} />
              <Sk w="70%" h={12} />
            </div>
          ))}
        </div>
      </section>
      <section className="sk-section">
        <SectionHead />
        <div className="sk-strip">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="sk-strip-card">
              <Sk h={120} r={14} />
              <Sk w="80%" h={14} />
              <Sk w="50%" h={12} />
            </div>
          ))}
        </div>
      </section>
      <section className="sk-section">
        <SectionHead />
        <Chips />
        <Rows count={4} thumb={44} />
      </section>
    </Shell>
  );
}

export function RestaurantDetailSkeleton() {
  return (
    <Shell className="container" style={{ paddingBottom: 48 }}>
      <div className="sk-photo-grid">
        <Sk h="100%" r={16} className="sk-photo-main" />
        <Sk h="100%" r={12} />
        <Sk h="100%" r={12} />
        <Sk h="100%" r={12} />
        <Sk h="100%" r={12} className="sk-desktop-only" />
      </div>
      <div className="sk-detail-body">
        <Sk w="62%" h={28} r={8} />
        <div className="sk-inline">
          <Sk w={90} h={16} />
          <Sk w={140} h={16} />
          <Sk w={80} h={24} r={999} />
        </div>
        <Sk w="100%" h={44} r={12} style={{ maxWidth: 360 }} />
        <div className="sk-card">
          <Sk w="40%" h={18} />
          <Sk w="90%" h={13} />
          <Sk w="75%" h={13} />
          <Sk w="60%" h={13} />
        </div>
        <div className="sk-card">
          <Sk w="35%" h={18} />
          <Rows count={3} thumb={52} />
        </div>
      </div>
    </Shell>
  );
}

export function ListPageSkeleton({ chips = false, avatar = false, rows = 6, maxWidth }: { chips?: boolean; avatar?: boolean; rows?: number; maxWidth?: number }) {
  return (
    <Shell style={maxWidth ? { maxWidth } : undefined}>
      <PageHeader />
      {chips ? <Chips /> : null}
      <Rows count={rows} avatar={avatar} />
    </Shell>
  );
}

export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <Shell>
      <PageHeader />
      <div className="sk-card-grid">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="sk-grid-card">
            <Sk h={130} r={14} />
            <Sk w="70%" h={15} />
            <Sk w="40%" h={12} />
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function ProfileSkeleton() {
  return (
    <Shell style={{ maxWidth: 720 }}>
      <div className="sk-profile-head">
        <Sk w={76} h={76} r={999} style={{ flex: 'none' }} />
        <div className="sk-row-body">
          <Sk w="55%" h={22} r={6} />
          <Sk w="35%" h={13} />
          <Sk w="70%" h={13} />
        </div>
      </div>
      <div className="sk-stats">
        {Array.from({ length: 3 }, (_, i) => (
          <Sk key={i} h={58} r={12} />
        ))}
      </div>
      <Sk h={44} r={12} />
      <Rows count={4} />
    </Shell>
  );
}

export function FormPageSkeleton() {
  return (
    <Shell style={{ maxWidth: 640 }}>
      <PageHeader />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="sk-field">
          <Sk w={110} h={13} />
          <Sk h={44} r={10} />
        </div>
      ))}
      <Sk w={160} h={44} r={999} />
    </Shell>
  );
}

export function MapSkeleton() {
  return (
    <Shell className="sk-map">
      <Sk h="100%" r={0} />
    </Shell>
  );
}
