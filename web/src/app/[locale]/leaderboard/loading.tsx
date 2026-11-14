import { ListPageSkeleton } from '@/components/Skeletons';

export default function LeaderboardLoading() {
  return <ListPageSkeleton chips avatar rows={8} maxWidth={640} />;
}
