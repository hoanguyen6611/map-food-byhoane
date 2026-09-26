"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { FilterIcon, CloseIcon, StarIcon } from "./icons";
import { useMapFilterDrawerState } from "./MapFilterDrawerContext";

interface Props {
  /** The (server-rendered) <SearchFilterForm basePath="/map" ... /> — passed through as children so this stays a small client-only open/close shell around it. */
  children: React.ReactNode;
  label: string;
  closeLabel: string;
  /** Number of filters currently applied — shown as a badge on the trigger button, same idea as the notifications bell's unread count. */
  activeCount: number;
}

/**
 * The Map page's list+canvas layout has no room for a permanent filter
 * sidebar the way /search does (see this component's own doc comment on
 * SearchFilterForm) — this reuses EditProfileModal's overlay+panel pattern
 * instead, so opening filters doesn't disturb the compact list/map layout
 * for visitors who never touch them.
 */
export function MapFilterDrawer({
  children,
  label,
  closeLabel,
  activeCount,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const sharedState = useMapFilterDrawerState();

  useEffect(() => {
    sharedState?.setIsOpen(isOpen);
  }, [isOpen, sharedState]);

  const selected = sharedState?.selected ?? null;

  return (
    <>
      <button
        type="button"
        className="map-filter-trigger-btn"
        onClick={() => setIsOpen(true)}
      >
        <FilterIcon size={16} />
        {label}
        {activeCount > 0 ? (
          <span className="notification-badge map-filter-trigger-badge">
            {activeCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className="profile-edit-modal-overlay map-filter-drawer-overlay"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="profile-edit-modal-panel map-filter-drawer-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed — doesn't scroll away with the filter list below it. */}
            <div className="profile-edit-modal-header map-filter-drawer-header">
              <h2 className="info-card-title" style={{ margin: 0 }}>
                {label}
              </h2>
              <button
                type="button"
                className="profile-edit-modal-close"
                aria-label={closeLabel}
                onClick={() => setIsOpen(false)}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="profile-edit-modal-scroll map-filter-drawer-scroll">
              {children}
            </div>

            {/* The map's own floating card (MapPageClient) hides itself
                while this drawer is open, since it'd otherwise sit on top
                of this modal's backdrop — this is that same "currently
                selected" info, shown inside the drawer instead. */}
            {selected ? (
              <div className="map-filter-drawer-selected">
                <span
                  className={`map-page-floating-tile ${selected.thumbnailUrl ? "" : selected.placeTileClass}`}
                >
                  {selected.thumbnailUrl ? (
                    <Image
                      src={selected.thumbnailUrl}
                      alt=""
                      width={52}
                      height={52}
                    />
                  ) : null}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  <Link
                    href={`/restaurant/${selected.slug}`}
                    className="place-row-name"
                    style={{ fontSize: 15 }}
                  >
                    {selected.name}
                  </Link>
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <StarIcon size={11} />
                    <span
                      className="font-num"
                      style={{ fontSize: 14, fontWeight: 600 }}
                    >
                      {selected.compositeScore !== null
                        ? selected.compositeScore.toFixed(1)
                        : selected.noRatingLabel}
                    </span>
                    <span
                      className="font-meta"
                      style={{ fontSize: 13, color: "var(--color-ink-subtle)" }}
                    >
                      ({selected.reviewCount})
                    </span>
                  </span>
                  <Link
                    href={`/restaurant/${selected.slug}`}
                    className="section-link"
                    style={{ fontSize: 13 }}
                  >
                    {selected.viewDetailLabel}
                  </Link>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
