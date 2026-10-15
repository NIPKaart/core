import { discoveryDestinationUrl } from '@/lib/discovery-filters';
import { locationMap } from '@/routes';
import type { Favorite } from '@/types';
import type { DestinationResult, ParkingResult } from '@/types/destination';

export function destinationMapUrl(destination: DestinationResult): string {
    return discoveryDestinationUrl(new URL(locationMap.url(), window.location.origin), destination);
}

export function favoriteParkingResult(favorite: Favorite): ParkingResult | null {
    if (!favorite.available || favorite.latitude === null || favorite.longitude === null || favorite.type === 'Unknown') return null;
    const sources = { Community: 'community', Municipal: 'municipal', Offstreet: 'offstreet' } as const;
    const source = sources[favorite.type];
    return {
        key: `${source}:${favorite.id}`,
        id: favorite.id,
        source,
        title: favorite.title,
        latitude: favorite.latitude,
        longitude: favorite.longitude,
        distance_metres: null,
    };
}

export function favoriteMapUrl(place: ParkingResult): string {
    return locationMap.url({ query: { place: place.key, at: `${place.latitude},${place.longitude}` } });
}
