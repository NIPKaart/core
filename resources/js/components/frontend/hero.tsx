export default function Hero() {
    return (
        <div className="relative isolate px-6 pt-20 lg:px-8">
            {/* Background flair (boven) */}
            <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl">
                <div
                    className="relative left-1/2 aspect-[1155/678] w-[36rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#fb4b1c] to-[#f97316] opacity-30 sm:w-[72rem]"
                    style={{
                        clipPath:
                            'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%)',
                    }}
                />
            </div>

            {/* Content */}
            <div className="mx-auto max-w-2xl py-20 text-center">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
                    Ontdek parkeerruimtes. Deel je kennis.
                </h1>
                <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
                    NIPKaart helpt inwoners en bezoekers snel inzicht te krijgen in lokale parkeerregels. Voeg zelf informatie toe, verbeter de kaart
                    en help anderen navigeren door de wirwar van regels.
                </p>
                <div className="mt-10 flex items-center justify-center gap-x-6">
                    <a
                        href="#"
                        className="rounded-md bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
                    >
                        Bekijk de kaart
                    </a>
                    <a href={route('contact')} className="text-sm leading-6 font-semibold text-gray-900 dark:text-white">
                        Meer weten <span aria-hidden="true">→</span>
                    </a>
                </div>
            </div>
        </div>
    );
}
