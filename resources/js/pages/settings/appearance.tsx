import { Head } from '@inertiajs/react';

import AppearanceTabs from '@/components/appearance-tabs';
import HeadingSmall from '@/components/heading-small';
import { type BreadcrumbItem } from '@/types';

import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit as editAppearance } from '@/routes/appearance';
import { useTranslation } from 'react-i18next';

export default function Appearance() {
    const { t } = useTranslation('backend/settings');

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('appearance.meta.breadcrumb'),
            href: editAppearance(),
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('appearance.meta.title')} />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall title={t('appearance.title')} description={t('appearance.description')} />
                    <AppearanceTabs />
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
