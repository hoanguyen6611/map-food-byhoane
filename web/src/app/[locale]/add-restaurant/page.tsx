import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import { getCategories } from '@/lib/api';
import { AddRestaurantForm } from '@/components/AddRestaurantForm';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'addRestaurant' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function AddRestaurantPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  const [t, categories] = await Promise.all([getTranslations('addRestaurant'), getCategories()]);

  return (
    <div className="container page-sections" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <h1 className="section-title" style={{ margin: 0 }}>
          {t('title')}
        </h1>
        <p className="page-header-sub">{t('intro')}</p>
      </div>
      <AddRestaurantForm categories={categories} />
    </div>
  );
}
