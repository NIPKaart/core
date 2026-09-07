import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import passkey from '@/routes/passkey';
import security from '@/routes/security';
import twoFactor from '@/routes/two-factor';
import { Form, Head, router } from '@inertiajs/react';
import { Passkeys, UserCancelledError } from '@laravel/passkeys';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = { twoFactorEnabled: boolean; twoFactorPending: boolean; passkeys: { id: number; name: string; last_used_at: string | null }[] };

export default function Security({ twoFactorEnabled, twoFactorPending, passkeys }: Props) {
    const { t } = useTranslation('backend/security');
    const [setup, setSetup] = useState<{ svg: string; secretKey: string } | null>(null);
    const [codes, setCodes] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [name, setName] = useState('');
    const [supported, setSupported] = useState(false);
    useEffect(() => {
        setSupported(Passkeys.isSupported());
    }, []);

    async function readJson(url: string) {
        const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
        if (response.status === 423) {
            router.visit(security.edit.url());
            throw new Error('confirmation');
        }
        if (!response.ok || response.redirected) throw new Error('request');
        return response.json();
    }
    async function loadSetup() {
        setBusy(true);
        setError('');
        try {
            const [qr, secret] = await Promise.all([readJson(twoFactor.qrCode.url()), readJson(twoFactor.secretKey.url())]);
            setSetup({ svg: qr.svg, secretKey: secret.secretKey });
        } catch {
            setError(t('request_error'));
        } finally {
            setBusy(false);
        }
    }
    async function loadCodes() {
        setBusy(true);
        setError('');
        try {
            setCodes(await readJson(twoFactor.recoveryCodes.url()));
        } catch {
            setError(t('request_error'));
        } finally {
            setBusy(false);
        }
    }
    async function register(event: React.FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            await Passkeys.register({ name });
            setName('');
            router.reload();
        } catch (error) {
            setError(t(error instanceof UserCancelledError ? 'cancelled' : 'passkey_error'));
        } finally {
            setBusy(false);
        }
    }
    return (
        <AppLayout breadcrumbs={[{ title: t('title'), href: security.edit() }]}>
            <Head title={t('title')} />
            <SettingsLayout>
                <div className="space-y-8">
                    <HeadingSmall title={t('two_factor')} description={t('two_factor_help')} />
                    <p role="status">{t(twoFactorEnabled ? 'enabled' : twoFactorPending ? 'pending' : 'disabled')}</p>
                    {!twoFactorEnabled && !twoFactorPending && (
                        <Form {...twoFactor.enable.form()} options={{ preserveScroll: true }}>
                            {({ processing, errors }) => (
                                <>
                                    <Button disabled={processing}>{t('enable')}</Button>
                                    <InputError message={errors.default} />
                                </>
                            )}
                        </Form>
                    )}
                    {twoFactorPending && (
                        <div className="space-y-4">
                            <Button variant="outline" onClick={loadSetup} disabled={busy}>
                                {t('show_setup')}
                            </Button>
                            {setup && (
                                <div className="space-y-3">
                                    <p>{t('scan')}</p>
                                    <div className="w-fit bg-white p-3" dangerouslySetInnerHTML={{ __html: setup.svg }} />
                                    <p className="text-sm">{t('manual_key')}</p>
                                    <code className="break-all">{setup.secretKey}</code>
                                    <Form
                                        {...twoFactor.confirm.form()}
                                        errorBag="confirmTwoFactorAuthentication"
                                        resetOnSuccess
                                        options={{ preserveScroll: true }}
                                        onSuccess={() => {
                                            setSetup(null);
                                            void loadCodes();
                                        }}
                                        className="space-y-3"
                                    >
                                        {({ processing, errors }) => (
                                            <>
                                                <Label htmlFor="totp-code">{t('code')}</Label>
                                                <Input id="totp-code" name="code" inputMode="numeric" autoComplete="one-time-code" required />
                                                <InputError message={errors.code} />
                                                <Button disabled={processing}>{t('confirm')}</Button>
                                            </>
                                        )}
                                    </Form>
                                </div>
                            )}
                        </div>
                    )}
                    {twoFactorEnabled && (
                        <div className="space-y-4">
                            <p>{t('recovery_help')}</p>
                            <Button variant="outline" disabled={busy} onClick={loadCodes}>
                                {t('show_recovery')}
                            </Button>
                            {codes.length > 0 && (
                                <div className="space-y-3">
                                    <ul className="grid grid-cols-2 gap-2 rounded border p-4 font-mono">
                                        {codes.map((code) => (
                                            <li key={code}>{code}</li>
                                        ))}
                                    </ul>
                                    <Button variant="outline" onClick={() => setCodes([])}>
                                        {t('hide_recovery')}
                                    </Button>
                                    <Form
                                        {...twoFactor.regenerateRecoveryCodes.form()}
                                        options={{ preserveScroll: true }}
                                        onSuccess={() => void loadCodes()}
                                    >
                                        {({ processing }) => (
                                            <Button variant="outline" disabled={processing}>
                                                {t('regenerate')}
                                            </Button>
                                        )}
                                    </Form>
                                </div>
                            )}
                        </div>
                    )}
                    {(twoFactorEnabled || twoFactorPending) && (
                        <Form
                            {...twoFactor.disable.form()}
                            options={{ preserveScroll: true }}
                            onSuccess={() => {
                                setSetup(null);
                                setCodes([]);
                            }}
                        >
                            {({ processing }) => (
                                <Button variant="destructive" disabled={processing}>
                                    {t(twoFactorPending ? 'cancel_setup' : 'disable')}
                                </Button>
                            )}
                        </Form>
                    )}
                    <HeadingSmall title={t('passkeys')} description={t('passkeys_help')} />
                    {!supported && <p className="text-sm text-muted-foreground">{t('unsupported')}</p>}
                    {passkeys.length === 0 && <p>{t('no_passkeys')}</p>}
                    <ul className="space-y-3">
                        {passkeys.map((key) => (
                            <li className="flex items-center justify-between gap-4 rounded border p-3" key={key.id}>
                                <span className="break-all">{key.name}</span>
                                <Form {...passkey.destroy.form(key.id)} options={{ preserveScroll: true }}>
                                    {({ processing, errors }) => (
                                        <>
                                            <Button variant="outline" disabled={processing} aria-label={t('delete_named', { name: key.name })}>
                                                {t('delete')}
                                            </Button>
                                            <InputError message={errors.default} />
                                        </>
                                    )}
                                </Form>
                            </li>
                        ))}
                    </ul>
                    <form onSubmit={register} className="space-y-3">
                        <Label htmlFor="passkey-name">{t('passkey_name')}</Label>
                        <Input id="passkey-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={255} required />
                        <Button disabled={!supported || busy}>{t('add_passkey')}</Button>
                    </form>
                    <InputError message={error} />
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
