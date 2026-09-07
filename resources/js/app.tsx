import '../css/app.css';
import '../css/leaflet-legend.css';

// Import the Echo configuration
import '@/echo';

import { createInertiaApp } from '@inertiajs/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType } from 'react';
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
        return <QueryClientProvider client={queryClient}>{app}</QueryClientProvider>;
    },
    progress: {
        color: '#4B5563',
    },
});

initializeTheme();
