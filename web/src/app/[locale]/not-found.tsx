import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <div className="container empty-state" style={{ paddingTop: 64 }}>
      <h1>{t('title')}</h1>
      <p>{t('body')}</p>
      <Link href="/">{t('backHome')}</Link>
    </div>
  );
}
