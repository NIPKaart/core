import { useCallback, useEffect, useState } from 'react';

const KEY = 'nip_recent_searches';
const MAX = 8;

function readRecent(): string[] {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
    } catch (err) {
        if (import.meta.env.DEV) console.debug('readRecent failed', err);
        return [];
    }
}

function writeRecent(list: string[]) {
    try {
        localStorage.setItem(KEY, JSON.stringify(list));
    } catch (err) {
        if (import.meta.env.DEV) console.debug('writeRecent failed', err);
    }
}

export function useRecentSearches() {
    const [items, setItems] = useState<string[]>([]);

    useEffect(() => {
        setItems(readRecent());
    }, []);

    const add = useCallback((q: string) => {
        const v = q.trim();
        if (!v) return;
        setItems((prev) => {
            const next = [v, ...prev.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, MAX);
            writeRecent(next);
            return next;
        });
    }, []);

    const clear = useCallback(() => {
        writeRecent([]);
        setItems([]);
    }, []);

    return { items, add, clear };
}
