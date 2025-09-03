import { usePage } from '@inertiajs/react';

type WayfinderResult = string | { url: string } | { url: () => string };
type WayfinderCallable = () => WayfinderResult;
type HrefLike = string | WayfinderResult | WayfinderCallable;

function toUrl(href: HrefLike): string {
    if (typeof href === 'string') return href;

    if (typeof href === 'function') {
        const res = href();
        return toUrl(res);
    }

    if ('url' in href) {
        const val = href.url;
        return typeof val === 'function' ? val() : val;
    }

    return '/';
}

export function useIsActive() {
    const { url } = usePage<{ url: string }>();
    const current = url || '/';

    const isActive = (href: HrefLike, { prefix = false } = {}) => {
        const target = toUrl(href);
        if (prefix) {
            return current === target || current.startsWith(target + '/') || current.startsWith(target + '?');
        }
        return current === target || current.startsWith(target + '?');
    };

    return { isActive };
}
