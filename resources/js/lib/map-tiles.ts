export type TileCoordinate = { zoom: number; x: number; y: number };

export type GeoBox = { west: number; south: number; east: number; north: number };

export function tileKey({ zoom, x, y }: TileCoordinate): string {
    return `${zoom}/${x}/${y}`;
}

const MAX_LATITUDE = 85.0511287798;

function tileX(longitude: number, zoom: number): number {
    return ((longitude + 180) / 360) * 2 ** zoom;
}

function tileY(latitude: number, zoom: number): number {
    const radians = (Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude)) * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** zoom;
}

/**
 * Tiles covering a box plus a ring of `buffer` tiles, nearest to the centre first so the middle of the view fills in first.
 */
export function tilesCovering(box: GeoBox, zoom: number, buffer = 0): TileCoordinate[] {
    const last = 2 ** zoom - 1;
    const clamp = (value: number) => Math.min(last, Math.max(0, value));
    const minX = clamp(Math.floor(tileX(box.west, zoom)) - buffer);
    const maxX = clamp(Math.floor(tileX(box.east, zoom)) + buffer);
    const minY = clamp(Math.floor(tileY(box.north, zoom)) - buffer);
    const maxY = clamp(Math.floor(tileY(box.south, zoom)) + buffer);
    const centreX = tileX((box.west + box.east) / 2, zoom) - 0.5;
    const centreY = tileY((box.south + box.north) / 2, zoom) - 0.5;

    const tiles: TileCoordinate[] = [];
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            tiles.push({ zoom, x, y });
        }
    }

    return tiles.sort((a, b) => Math.hypot(a.x - centreX, a.y - centreY) - Math.hypot(b.x - centreX, b.y - centreY));
}

/**
 * A least-recently-used cache of tile requests. Failed requests are evicted so a later view retries them.
 */
export class TileCache<T> {
    private entries = new Map<string, { promise: Promise<T>; data?: T }>();

    constructor(
        private load: (tile: TileCoordinate) => Promise<T>,
        private capacity = 400,
    ) {}

    fetch(tile: TileCoordinate): Promise<T> {
        const key = tileKey(tile);
        const cached = this.entries.get(key);
        if (cached) {
            this.entries.delete(key);
            this.entries.set(key, cached);
            return cached.promise;
        }

        const entry: { promise: Promise<T>; data?: T } = {
            promise: this.load(tile).then(
                (data) => {
                    entry.data = data;
                    return data;
                },
                (error) => {
                    if (this.entries.get(key) === entry) this.entries.delete(key);
                    throw error;
                },
            ),
        };
        this.entries.set(key, entry);
        while (this.entries.size > this.capacity) {
            this.entries.delete(this.entries.keys().next().value!);
        }

        return entry.promise;
    }

    /** The loaded payload, without triggering a request. */
    peek(tile: TileCoordinate): T | undefined {
        return this.entries.get(tileKey(tile))?.data;
    }
}
