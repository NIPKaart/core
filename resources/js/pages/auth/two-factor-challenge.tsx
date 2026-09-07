import TwoFactorAuthenticatedSessionController from '@/actions/Laravel/Fortify/Http/Controllers/TwoFactorAuthenticatedSessionController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';
import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function TwoFactorChallenge() {
    const { t } = useTranslation('backend/security');
    const [recovery, setRecovery] = useState(false);
    return (
        <AuthLayout title={t('challenge')} description={t(recovery ? 'recovery_help' : 'challenge_help')}>
            <Head title={t('challenge')} />
            <Form key={String(recovery)} {...TwoFactorAuthenticatedSessionController.store.form()} resetOnError resetOnSuccess className="space-y-6">
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-2">
                            <Label htmlFor="code">{t(recovery ? 'recovery_code' : 'code')}</Label>
                            <Input
                                id="code"
                                name={recovery ? 'recovery_code' : 'code'}
                                autoComplete="one-time-code"
                                inputMode={recovery ? 'text' : 'numeric'}
                                required
                                autoFocus
                            />
                            <InputError message={errors.code ?? errors.recovery_code} />
                        </div>
                        <Button className="w-full" disabled={processing}>
                            {t('confirm')}
                        </Button>
                    </>
                )}
            </Form>
            <Button variant="link" type="button" onClick={() => setRecovery(!recovery)}>
                {t(recovery ? 'use_code' : 'use_recovery')}
            </Button>
        </AuthLayout>
    );
}
