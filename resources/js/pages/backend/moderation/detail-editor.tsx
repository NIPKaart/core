import DetailsStep, { type DetailsSection } from '@/components/contribute/details-step';
import type { ContributionForm } from '@/components/contribute/types';
import { Button } from '@/components/ui/button';
import { Pencil, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fromForm, toForm } from './edit-form';
import { Kbd } from './shortcuts';
import type { Options } from './types';
import { GROUP_FIELDS, type ChangeGroup, type ImprovementValues } from './values';

/**
 * The submitted details in the add flow's own form, beside the item. Every change shows at once in the review and on
 * the map; Cancel puts back what was there when the editor opened, Done and Esc keep it.
 */
export function DetailEditor({
    values,
    patch,
    options,
    sections,
    onCancel,
    onDone,
}: {
    values: ImprovementValues;
    /** Applies one change to the latest values, so two changes in a row both count. */
    patch: (change: (previous: ImprovementValues) => Partial<ImprovementValues>) => void;
    options: Options;
    sections: DetailsSection[];
    onCancel: () => void;
    onDone: () => void;
}) {
    const { t } = useTranslation('backend/moderation');
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => heading.current?.focus(), []);

    return (
        <div
            className="flex min-h-0 flex-1 flex-col"
            onKeyDown={(event) => {
                if (event.key !== 'Escape') return;
                // Handled here, so the page does not also leave the item. Closing keeps the changes; nothing is lost.
                event.preventDefault();
                onDone();
            }}
        >
            <div className="flex shrink-0 items-center gap-2 border-b py-2.5 pr-3 pl-5">
                <h2 ref={heading} tabIndex={-1} className="flex-1 text-lg font-bold outline-none">
                    {t('edit.title')}
                </h2>
                <Button variant="ghost" size="icon" className="size-9 cursor-pointer" aria-label={t('edit.close')} onClick={onDone}>
                    <X className="size-[18px]" />
                </Button>
            </div>
            <div
                className="min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto overscroll-contain px-5 py-4"
                data-editor-scroll
            >
                <DetailsStep
                    data={toForm(values)}
                    setData={<K extends keyof ContributionForm>(key: K, value: ContributionForm[K]) =>
                        patch((previous) => fromForm(previous, key, value))
                    }
                    errors={{}}
                    orientationOptions={options.orientations}
                    restrictionDays={options.restrictionDays}
                    sections={sections}
                    variant="plain"
                />
            </div>
            <div className="flex shrink-0 gap-2 border-t px-5 py-3">
                <Button variant="outline" className="flex-1 basis-0 cursor-pointer" onClick={onCancel}>
                    {t('decide.cancel')}
                </Button>
                <Button className="flex-1 basis-0 cursor-pointer" onClick={onDone}>
                    {t('edit.done')}
                    <Kbd inverted aria-hidden>
                        Esc
                    </Kbd>
                </Button>
            </div>
        </div>
    );
}

/** Which parts of the add flow's form edit which change groups. */
export const EDITABLE: Partial<Record<ChangeGroup, DetailsSection>> = { orientation: 'orientation', under_sign: 'under_sign', description: 'note' };

/**
 * Opening and closing the editor for a draft. Cancel puts back only the groups the editor changes, as they were when
 * it opened; a location moved on the map stays. Focus returns to the button that opened the editor.
 */
export function useDetailEditor(draft: ImprovementValues, setDraft: React.Dispatch<React.SetStateAction<ImprovementValues>>, groups: ChangeGroup[]) {
    const [open, setOpen] = useState(false);
    const snapshot = useRef(draft);
    const trigger = useRef<HTMLButtonElement>(null);
    const close = () => {
        setOpen(false);
        requestAnimationFrame(() => trigger.current?.focus());
    };

    return {
        open,
        trigger,
        sections: groups.map((group) => EDITABLE[group]).filter((section): section is DetailsSection => section !== undefined),
        start: () => {
            snapshot.current = draft;
            setOpen(true);
        },
        done: close,
        cancel: () => {
            const fields = groups.flatMap((group) => GROUP_FIELDS[group]);
            setDraft((previous) => ({ ...previous, ...Object.fromEntries(fields.map((field) => [field, snapshot.current[field]])) }));
            close();
        },
        patch: (change: (previous: ImprovementValues) => Partial<ImprovementValues>) =>
            setDraft((previous) => ({ ...previous, ...change(previous) })),
    };
}

/** The one way into editing the details, pressed while the editor is open. */
export function EditDetailsButton({ editor }: { editor: ReturnType<typeof useDetailEditor> }) {
    const { t } = useTranslation('backend/moderation');

    return (
        <Button
            ref={editor.trigger}
            variant={editor.open ? 'default' : 'outline'}
            size="sm"
            aria-pressed={editor.open}
            className="cursor-pointer"
            onClick={() => (editor.open ? editor.done() : editor.start())}
        >
            <Pencil aria-hidden />
            {t('edit.open')}
        </Button>
    );
}
