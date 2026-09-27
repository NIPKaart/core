import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMediaQuery } from '@/hooks/use-media-query';
import { defaultDiscoveryFilters, type DiscoveryFilters as Filters } from '@/lib/discovery-filters';
import { SlidersHorizontal } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function DiscoveryFilters({
    value,
    onChange,
    disabled = false,
}: {
    value: Filters;
    onChange: (filters: Filters) => void;
    disabled?: boolean;
}) {
    const { t } = useTranslation('frontend/map/main');
    const id = useId();
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<Filters>(value);
    const changed = Object.entries(defaultDiscoveryFilters).some(([key, defaultValue]) => value[key as keyof Filters] !== defaultValue);
    const onOpenChange = (next: boolean) => {
        if (next) setDraft({ ...value });
        setOpen(next);
    };
    const trigger = (
        <Button
            variant="outline"
            disabled={disabled}
            title={disabled ? t('toolbar.choose_destination') : undefined}
            className="h-[50px] gap-2 rounded-xl border-border/70 bg-background px-4 shadow-md"
        >
            <SlidersHorizontal className="size-4" aria-hidden />
            {t('filters.title')}
            {changed && (
                <>
                    <span aria-hidden className="size-1.5 rounded-full bg-orange-500" />
                    <span className="sr-only">{t('filters.active')}</span>
                </>
            )}
        </Button>
    );
    const actions = (
        <div className="flex gap-3 pb-1">
            <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => setDraft({ ...defaultDiscoveryFilters })}>
                {t('filters.reset')}
            </Button>
            <Button type="submit" form={`${id}-form`} className="min-h-11 flex-1">
                {t('filters.apply')}
            </Button>
        </div>
    );
    const form = (
        <form
            id={`${id}-form`}
            className="flex flex-col gap-5"
            onSubmit={(event) => {
                event.preventDefault();
                onChange({ ...draft });
                setOpen(false);
            }}
        >
            <div className="flex flex-col gap-2">
                <label htmlFor={`${id}-source`} className="text-sm font-medium">
                    {t('filters.source')}
                </label>
                <Select value={draft.source} onValueChange={(source: Filters['source']) => setDraft({ ...draft, source })}>
                    <SelectTrigger id={`${id}-source`} className="min-h-11 w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(['all', 'community', 'municipal', 'offstreet'] as const).map((source) => (
                            <SelectItem key={source} value={source}>
                                {t(`filters.sources.${source}`)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col gap-2">
                <label htmlFor={`${id}-radius`} className="text-sm font-medium">
                    {t('filters.radius')}
                </label>
                <Select value={String(draft.radius)} onValueChange={(radius) => setDraft({ ...draft, radius: Number(radius) })}>
                    <SelectTrigger id={`${id}-radius`} className="min-h-11 w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {[250, 500, 1000, 2000, 5000, 10000].map((radius) => (
                            <SelectItem key={radius} value={String(radius)}>
                                {radius < 1000 ? `${radius} m` : `${radius / 1000} km`}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col gap-2">
                <label htmlFor={`${id}-sort`} className="text-sm font-medium">
                    {t('filters.sort')}
                </label>
                <Select value={draft.sort} onValueChange={(sort: Filters['sort']) => setDraft({ ...draft, sort })}>
                    <SelectTrigger id={`${id}-sort`} className="min-h-11 w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {['balanced', 'distance'].map((sort) => (
                            <SelectItem key={sort} value={sort}>
                                {t(`filters.sorts.${sort}`)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-xs leading-relaxed text-muted-foreground">{t(`filters.explanation.${draft.sort}`)}</p>
            </div>
            {isDesktop && actions}
        </form>
    );
    if (isDesktop)
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogTrigger asChild>{trigger}</DialogTrigger>
                <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('filters.title')}</DialogTitle>
                        <DialogDescription>{t('filters.description')}</DialogDescription>
                    </DialogHeader>
                    {form}
                </DialogContent>
            </Dialog>
        );
    return (
        <Drawer autoFocus open={open} onOpenChange={onOpenChange}>
            <DrawerTrigger asChild>{trigger}</DrawerTrigger>
            <DrawerContent className="mx-auto max-w-xl overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[90dvh]">
                <DrawerHeader className="shrink-0 text-left">
                    <DrawerTitle>{t('filters.title')}</DrawerTitle>
                    <DrawerDescription>{t('filters.description')}</DrawerDescription>
                </DrawerHeader>
                <div className="min-h-0 overflow-y-auto overscroll-contain px-4">{form}</div>
                <DrawerFooter className="shrink-0 border-t pb-[calc(1rem+env(safe-area-inset-bottom))]">{actions}</DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
