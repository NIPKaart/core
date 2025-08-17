// Components
import { Form, Head } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';

import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/auth-layout';
import { useTranslation } from 'react-i18next';

export default function VerifyEmail({ status }: { status?: string }) {
    const { t } = useTranslation('backend/auth');

    return (
        <AuthLayout title={t('verify.title')} description={t('verify.description')}>
            <Head title={t('verify.meta')} />

            {status === 'verification-link-sent' && <div className="mb-4 text-center text-sm font-medium text-green-600">{t('verify.sent')}</div>}

            <Form method="post" action={route('verification.send')} className="space-y-6 text-center">
                {({ processing }) => (
                    <>
                        <Button disabled={processing} variant="secondary">
                            {processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                            {t('verify.resend')}
                        </Button>

                        <TextLink href={route('logout')} method="post" className="mx-auto block text-sm">
                            {t('verify.logout')}
                        </TextLink>
                    </>
                )}
            </Form>
        </AuthLayout>
    );
}
