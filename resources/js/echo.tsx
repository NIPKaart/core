import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
declare global {
    interface Window {
        Pusher: typeof Pusher;
    }
}
window.Pusher = Pusher;

const tls = import.meta.env.VITE_REVERB_SCHEME !== 'http';
const host = import.meta.env.VITE_REVERB_HOST || window.location.hostname;
const port = Number(import.meta.env.VITE_REVERB_PORT || (tls ? 443 : 80));

let echo: Echo<'reverb'> | undefined;

export function getEcho() {
    if (!import.meta.env.VITE_REVERB_APP_KEY) return undefined;

    return (echo ??= new Echo({
        broadcaster: 'reverb',
        key: import.meta.env.VITE_REVERB_APP_KEY,
        wsHost: host,
        wsPort: port,
        wssPort: port,
        forceTLS: tls,
        encrypted: tls,
        enabledTransports: ['ws', 'wss'],
        disableStats: true,
    }));
}
