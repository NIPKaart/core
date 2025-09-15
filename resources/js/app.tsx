import '../css/app.css';
import '../css/leaflet-legend.css';

// Import the i18n configuration
import '@/i18n';

// Import the Echo configuration
import '@/echo';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

// Create a single QueryClient instance (outside setup for HMR)
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 10_000, // 10s "vers"
            gcTime: 5 * 60_000, // 5 min cache
            refetchOnWindowFocus: false,
        },
    },
});

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(
            <QueryClientProvider client={queryClient}>
                <App {...props} />
            </QueryClientProvider>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
