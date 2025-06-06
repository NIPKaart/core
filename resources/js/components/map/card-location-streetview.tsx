interface StreetViewCardProps {
    latitude: number;
    longitude: number;
}

export default function StreetViewCard({ latitude, longitude }: StreetViewCardProps) {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const src = `https://www.google.com/maps/embed/v1/streetview?key=${apiKey}&location=${latitude},${longitude}`;

    return (
        <iframe
            src={src}
            className="h-80 w-full rounded-xl border md:h-[500px]"
            loading="lazy"
            allow="accelerometer; encrypted-media; fullscreen; geolocation; gyroscope; picture-in-picture"
            title="Street View"
        />
    );
}
