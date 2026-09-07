import '../css/app.css';
import '../css/leaflet-legend.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import { toast, Toaster } from 'sonner';
import { initializeTheme } from './hooks/use-appearance';
import i18n from './i18n';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';
const pages = import.meta.glob<{ default: ComponentType }>('./pages/**/*.tsx');
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 10_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
        },
    },
});

// Register before initialization so initial loads and later visits share one handler.
// Inertia flash data is excluded from browser history; equal messages on new visits still display.
const removeFlashListener = router.on('flash', ({ detail: { flash } }) => {
    for (const level of ['success', 'error', 'warning', 'info'] as const) {
        const message = flash[level];
        if (typeof message === 'string' && message.length > 0) toast[level](message);
    }
});
import.meta.hot?.dispose(removeFlashListener);

void createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: async (name) => {
        const load = pages[`./pages/${name}.tsx`];
        if (!load) throw new Error(`Unknown Inertia page: ${name}`);
        return (await load()).default;
    },
    strictMode: true,
    withApp(app, { page }) {
        // Initialize from the shared Laravel locale; later visits use useSyncLocale.
        void i18n.changeLanguage(String(page.props.locale || 'en'));
        return (
            <QueryClientProvider client={queryClient}>
                {app}
                <Toaster position="top-right" />
            </QueryClientProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});

initializeTheme();
