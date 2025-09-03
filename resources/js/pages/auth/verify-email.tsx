// Components
import { Form, Head } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';

import EmailVerificationNotificationController from '@/actions/App/Http/Controllers/Auth/EmailVerificationNotificationController';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/auth-layout';
import { logout } from '@/routes';
import { useTranslation } from 'react-i18next';

export default function VerifyEmail({ status }: { status?: string }) {
    const { t } = useTranslation('backend/auth');

    return (
        <AuthLayout title={t('verify.title')} description={t('verify.description')}>
            <Head title={t('verify.meta')} />

            {status === 'verification-link-sent' && <div className="mb-4 text-center text-sm font-medium text-green-600">{t('verify.sent')}</div>}

            <Form {...EmailVerificationNotificationController.store.form()} className="space-y-6 text-center">
                {({ processing }) => (
                    <>
                        <Button disabled={processing} variant="secondary">
                            {processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                            {t('verify.resend')}
                        </Button>

                        <TextLink href={logout()} method="post" className="mx-auto block text-sm">
                            {t('verify.logout')}
                        </TextLink>
                    </>
                )}
            </Form>
        </AuthLayout>
    );
}
