import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { confirm, confirmOptions } from '@/routes/passkey';
import { Passkeys, UserCancelledError } from '@laravel/passkeys';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function PasskeyButton({ confirmation = false }: { confirmation?: boolean }) {
    const { t } = useTranslation('backend/security');
    const [supported, setSupported] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        setSupported(Passkeys.isSupported());
    }, []);

    async function authenticate() {
        setBusy(true);
        setError('');
        try {
            const result = await Passkeys.verify(confirmation ? { routes: { options: confirmOptions.url(), submit: confirm.url() } } : {});
            window.location.assign(result.redirect ?? '/dashboard');
        } catch (error) {
            setError(t(error instanceof UserCancelledError ? 'cancelled' : 'passkey_error'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-2">
            <Button type="button" variant="outline" className="w-full" disabled={!supported || busy} onClick={authenticate}>
                {t(confirmation ? 'confirm_passkey' : 'login_passkey')}
            </Button>
            {!supported && <p className="text-sm text-muted-foreground">{t('unsupported')}</p>}
            <InputError message={error} />
        </div>
    );
}
