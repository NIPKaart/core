import { useStore } from '@tanstack/react-store';
import { Store } from '@tanstack/store';

type SearchState = {
    isOpen: boolean;
    query: string;
};

export const searchStore = new Store<SearchState>({
    isOpen: false,
    query: '',
});

// Selectors
export const useSearchOpen = (): boolean => useStore(searchStore, (s: SearchState) => s.isOpen);
export const useSearchQuery = (): string => useStore(searchStore, (s: SearchState) => s.query);

// Actions
export const openSearch = (): void => searchStore.setState((s: SearchState) => ({ ...s, isOpen: true }));
export const closeSearch = (): void => searchStore.setState((s: SearchState) => ({ ...s, isOpen: false }));
export const setSearchQuery = (v: string): void => searchStore.setState((s: SearchState) => ({ ...s, query: v }));
