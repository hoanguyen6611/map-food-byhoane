import type { RestaurantSocialLinkDto, SocialPlatform } from '@foodmap/shared-types';
import { formatSocialLinkDisplay } from '@/lib/format';
import { CheckIcon, FacebookIcon, GlobeIcon, InstagramIcon, TiktokIcon } from './icons';

const PLATFORM_ICON: Record<SocialPlatform, React.ReactNode> = {
  facebook: <FacebookIcon size={18} />,
  instagram: <InstagramIcon size={18} />,
  tiktok: <TiktokIcon size={18} />,
  website: <GlobeIcon size={18} />,
};

interface Props {
  links: RestaurantSocialLinkDto[];
  heading: string;
  caption: string;
  verifiedNote: string;
  reportHint: string;
  platformLabel: (platform: SocialPlatform) => string;
}

/** README's social-links card — only rendered when `links` is non-empty (see caller). */
export function SocialLinksCard({ links, heading, caption, verifiedNote, reportHint, platformLabel }: Props) {
  return (
    <div className="info-card">
      <div className="social-links-head">
        <h2 className="info-card-title" style={{ margin: 0 }}>
          {heading}
        </h2>
        <span className="social-links-caption">{caption}</span>
      </div>
      <div className="social-links-grid">
        {links.map((link) => (
          <a key={link.platform} href={link.url} target="_blank" rel="noopener noreferrer" className="social-link-item">
            <span className={`social-link-icon social-link-icon-${link.platform}`}>{PLATFORM_ICON[link.platform]}</span>
            <span className="social-link-body">
              <span className="social-link-name">
                {platformLabel(link.platform)}
                {link.verified ? <CheckIcon size={13} className="social-link-verified" /> : null}
              </span>
              <span className="social-link-handle">{formatSocialLinkDisplay(link.url)}</span>
            </span>
          </a>
        ))}
      </div>
      {links.some((l) => l.verified) ? <p className="social-links-note">{verifiedNote}</p> : null}
      <p className="social-links-note">{reportHint}</p>
    </div>
  );
}
