import { cn } from '@/lib/utils';
import { Radio, RadioGroup } from '@headlessui/react';
import type { ComponentProps, ReactNode } from 'react';

type RadioGroupItemProps = Omit<ComponentProps<typeof Radio>, 'children' | 'className'> & {
    children: ReactNode;
    className?: string;
};

function RadioGroupItem({ className, children, ...props }: RadioGroupItemProps) {
    return (
        <Radio
            data-slot="radio-group-item"
            className={cn(
                'group flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-input px-3 py-2 text-sm outline-none hover:bg-muted data-checked:border-primary data-checked:bg-muted data-focus:ring-[3px] data-focus:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50',
                className,
            )}
            {...props}
        >
            <span aria-hidden className="flex size-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground group-data-checked:border-primary">
                <span className="size-2 rounded-full bg-primary opacity-0 group-data-checked:opacity-100" />
            </span>
            {children}
        </Radio>
    );
}

export { RadioGroup, RadioGroupItem };
