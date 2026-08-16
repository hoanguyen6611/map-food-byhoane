/** One entry per day, oldest -> newest. `date` is an ISO `YYYY-MM-DD` (UTC). */
export interface AdminDashboardActivityPoint {
  date: string;
  newReviews: number;
  newContributions: number;
  newUsers: number;
}

/** Always 5 entries, ratings 1-5 in order, `count: 0` for ratings with no published reviews. */
export interface AdminDashboardRatingBucket {
  rating: 1 | 2 | 3 | 4 | 5;
  count: number;
}

/**
 * `GET /admin/dashboard` response (docs/04-screen-list.md §29). `activity`
 * always covers the last 30 days — the 7-day view is a client-side slice of
 * the last 7 entries, not a separate request.
 */
export interface AdminDashboardStatsDto {
  kpis: {
    pendingRestaurants: number;
    pendingReviews: number;
    newReports: number;
    activeUsers: number;
  };
  activity: AdminDashboardActivityPoint[];
  ratingDistribution: AdminDashboardRatingBucket[];
}
