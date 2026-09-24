import { cn } from '@/lib/utils';

export default function Heading({
    title,
    description,
    level = 2,
    className,
}: {
    title: string;
    description?: string;
    level?: 1 | 2;
    className?: string;
}) {
    const Title = level === 1 ? 'h1' : 'h2';
    return (
        <div className={cn('space-y-1', level === 2 && 'mb-8', className)}>
            <Title className={cn('font-semibold tracking-tight', level === 1 ? 'text-2xl' : 'text-xl')}>{title}</Title>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
    );
}
