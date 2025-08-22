import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import { useMediaQuery } from '@/hooks/use-media-query';
import { usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Meta = {
    appVersion: string;
    laravelVersion: string;
    phpVersion: string;
    build?: string | null;
};

export default function AboutResponsive({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const { t } = useTranslation('backend/about');
    const { props } = usePage<{ name: string; meta: Meta }>();

    const appName = props.name;
    const { appVersion, laravelVersion, phpVersion, build } = props.meta;

    const copyText = useMemo(() => {
        const lines = [
            appName,
            `${t('labels.app')}: v${appVersion}`,
            `${t('labels.laravel')}: ${laravelVersion}`,
            `${t('labels.php')}: ${phpVersion}`,
            ...(build ? [`${t('labels.build')}: ${build}`] : []),
        ];
        return lines.join('\n');
    }, [appName, appVersion, laravelVersion, phpVersion, build, t]);

    const [copying, setCopying] = useState(false);
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        try {
            setCopying(true);
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(copyText);
            } else {
                const el = document.createElement('textarea');
                el.value = copyText;
                el.setAttribute('readonly', '');
                el.style.position = 'absolute';
                el.style.left = '-9999px';
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } finally {
            setCopying(false);
        }
    }

    const Body = (
        <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('labels.app')}</span>
                <span className="font-mono">v{appVersion}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('labels.laravel')}</span>
                <span className="font-mono">{laravelVersion}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('labels.php')}</span>
                <span className="font-mono">{phpVersion}</span>
            </div>
            {build && (
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('labels.build')}</span>
                    <span className="font-mono">{build}</span>
                </div>
            )}
        </div>
    );

    const DesktopActions = (
        <>
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={copying} aria-live="polite" className="cursor-pointer">
                {copied ? t('actions.copied') : copying ? t('actions.copying') : t('actions.copy')}
            </Button>
            <Button size="sm" onClick={() => onOpenChange(false)} className="cursor-pointer">
                {t('actions.close')}
            </Button>
        </>
    );

    const MobileActions = (
        <Button variant="outline" onClick={handleCopy} disabled={copying} aria-live="polite" className="cursor-pointer">
            {copied ? t('actions.copied') : copying ? t('actions.copying') : t('actions.copy')}
        </Button>
    );

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('title', { app: appName })}</DialogTitle>
                        <DialogDescription>{t('description')}</DialogDescription>
                    </DialogHeader>

                    {Body}

                    <Separator className="my-3" />

                    <DialogFooter className="gap-2 sm:justify-end">{DesktopActions}</DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // Mobile (Drawer)
    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerHeader className="text-center">
                    <DrawerTitle className="text-center">{t('title', { app: appName })}</DrawerTitle>
                    <DrawerDescription className="text-center">{t('description')}</DrawerDescription>
                </DrawerHeader>

                <div className="px-4 pb-4">{Body}</div>

                <DrawerFooter>{MobileActions}</DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
