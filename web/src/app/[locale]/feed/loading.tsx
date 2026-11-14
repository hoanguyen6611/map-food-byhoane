import { ListPageSkeleton } from '@/components/Skeletons';

export default function FeedLoading() {
  return <ListPageSkeleton avatar rows={5} maxWidth={640} />;
}
