// Hand-authored inline SVG icons matching the Claude Design redesign spec
// (24x24 viewBox, stroke 1.5, round caps/joins, outline only, monochrome via
// currentColor) — paths copied from the design's prototype rather than
// pulling in an icon library, same zero-extra-UI-dep convention as
// lib/labels.ts's FACILITY_EMOJI before it.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </Base>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2" />
    </Base>
  );
}

export function StarIcon({ filled = true, size = 13, ...rest }: IconProps & { filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={filled ? 0 : 1.5}
      aria-hidden="true"
      {...rest}
    >
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9L3.5 9.7l5.9-.8z" />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z" />
    </Base>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </Base>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" />
    </Base>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v5M12 16h.01" />
    </Base>
  );
}

export function BookmarkIcon({ filled = false, ...rest }: IconProps & { filled?: boolean }) {
  return (
    <Base fill={filled ? 'currentColor' : 'none'} {...rest}>
      <path d="M6 4h12v16l-6-4-6 4z" />
    </Base>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 15V4M8.5 7.5 12 4l3.5 3.5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
    </Base>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Base>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Base>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Base strokeWidth={2.5} {...props}>
      <path d="M5 12.5L10 17l9-10" />
    </Base>
  );
}

export function SearchMinusIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4M9 11h4" />
    </Base>
  );
}

export function SortIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 4v16l-3-3M17 20V4l3 3" />
    </Base>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 5h16M7 12h10M10 19h4" />
    </Base>
  );
}

export function ListViewIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Base>
  );
}

export function GridViewIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
    </Base>
  );
}

export function DirectionsIcon(props: IconProps) {
  return <MapPinIcon {...props} />;
}

export function PlusIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 12h14" />
    </Base>
  );
}

export function LocateIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Base>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <circle cx="9" cy="9.5" r="1.5" />
      <path d="M4 19l5-5 3.5 3.5L16 14l4 4" />
    </Base>
  );
}

export function MenuFolderIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 4v16M17 4v6a3 3 0 0 1-3 3h-1M12 4v6" />
    </Base>
  );
}

export function GoogleGIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17M3.5 12h17" />
    </Base>
  );
}

export function AppleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M11 19h2" />
    </Base>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M15 8.5h-2a2 2 0 0 0-2 2V12H9v2.5h2V21h3v-6.5h2.2l.3-2.5H14v-1.2c0-.6.4-.8.8-.8H15z" />
    </Base>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17" cy="7" r="0.6" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function TiktokIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M13 3v11.2a3.3 3.3 0 1 1-3.3-3.3c.3 0 .6 0 .9.1" />
      <path d="M13 3c.3 2.3 2 4 4.3 4.3" />
    </Base>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.2 2.3 3.4 5.2 3.4 8.5s-1.2 6.2-3.4 8.5c-2.2-2.3-3.4-5.2-3.4-8.5s1.2-6.2 3.4-8.5Z" />
    </Base>
  );
}

export function ThumbsUpIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 21V10M2 12v9h4.5c1.5 0 1.5-1 3-1h6a2 2 0 0 0 2-2l1-5a2 2 0 0 0-2-2h-5l1-4a2 2 0 0 0-2-2L7 10" />
    </Base>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Base>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 15V4M8 8l4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Base>
  );
}

export function CoffeeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zM17 9h1.5a2.5 2.5 0 0 1 0 5H17M8 3c-.5.8-.5 1.2 0 2M12 3c-.5.8-.5 1.2 0 2" />
    </Base>
  );
}

export function MessageCircleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </Base>
  );
}

/** Renders one facility's icon from `FACILITY_ICON_PATH` (lib/labels.ts). */
export function FacilityIcon({ path, ...rest }: IconProps & { path: string }) {
  return (
    <Base {...rest}>
      <path d={path} />
    </Base>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M15 6l-6 6 6 6" />
    </Base>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 6l6 6-6 6" />
    </Base>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 9l6 6 6-6" />
    </Base>
  );
}

/** Folded-map brand mark — replaces the previous chopstick-pin logo per the
 * updated design. Same path the login page's own logo tile already used
 * (build-prompts/09-public-web.md's original mockup), now shared here so
 * every logo instance (topbar/footer/login) renders identically. */
export function MapLogoIcon(props: IconProps) {
  return (
    <Base strokeWidth={1.6} {...props}>
      <path d="M9 3.5 4 6v14l5-2.5 6 3 5-2.5V4l-5 2.5z" />
      <path d="M9 3.5v14M15 6.5v14" />
    </Base>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </Base>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </Base>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
    </Base>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M4.4 4.4l1.8 1.8M17.8 17.8l1.8 1.8M2.5 12H5M19 12h2.5M4.4 19.6l1.8-1.8M17.8 6.2l1.8-1.8" />
    </Base>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
    </Base>
  );
}
