type Props = {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    align?: 'center' | 'left';
};

export default function HeroAbout({ eyebrow, title, subtitle, align = 'center' }: Props) {
    const isCenter = align === 'center';

    return (
        <section className="relative isolate px-6 pt-12 pb-20 sm:pt-14 sm:pb-24 lg:px-8 lg:pt-16 lg:pb-28">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl">
                <div
                    className="relative left-1/2 aspect-[1155/678] w-[32rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#fb4b1c] to-[#f97316] opacity-25 sm:w-[60rem]"
                    style={{
                        clipPath:
                            'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%)',
                    }}
                />
            </div>

            <div className={`mx-auto ${isCenter ? 'max-w-5xl text-center' : 'max-w-5xl text-left'}`}>
                {eyebrow ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-gray-900/5 px-3 py-1 text-xs font-medium text-gray-800 ring-1 ring-gray-900/10 dark:bg-white/10 dark:text-white dark:ring-white/20">
                        {eyebrow}
                    </span>
                ) : null}

                <h1 className="mt-3 text-4xl leading-tight font-bold tracking-tight text-gray-900 sm:mt-4 sm:text-6xl dark:text-white">{title}</h1>

                {subtitle ? (
                    <p className={`mt-5 text-lg leading-8 text-gray-700 dark:text-gray-300 ${isCenter ? 'mx-auto max-w-3xl' : 'max-w-3xl'}`}>
                        {subtitle}
                    </p>
                ) : null}
            </div>
        </section>
    );
}
