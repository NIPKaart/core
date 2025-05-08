import { CheckCircle } from 'lucide-react';

const features = [
    {
        title: 'Lokale expertise',
        description: 'Gemeentegrenzen kennen geen geheimen. Ontvang informatie van mensen die er écht wonen.',
    },
    {
        title: 'Community-gedreven',
        description: 'Gebruikers voegen samen nieuwe regels toe en verbeteren bestaande gegevens voortdurend.',
    },
    {
        title: 'Snel en overzichtelijk',
        description: 'Of je nu bewoner of bezoeker bent, vind snel de informatie die jij nodig hebt.',
    },
];

export default function Features() {
    return (
        <section className="bg-gray-50 py-20 sm:py-28 dark:bg-neutral-900">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <h2 className="text-base leading-7 font-semibold text-orange-600">Waarom NIPKaart?</h2>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
                        Praktisch. Lokaal. Betrouwbaar.
                    </p>
                    <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
                        We combineren gebruiksvriendelijkheid met lokale betrokkenheid zodat jij altijd weet waar je mag parkeren.
                    </p>
                </div>

                <div className="mt-16 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature) => (
                        <div key={feature.title} className="flex flex-col items-start">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="h-6 w-6 text-orange-600" />
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{feature.title}</h3>
                            </div>
                            <p className="mt-4 text-base text-gray-600 dark:text-gray-300">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
