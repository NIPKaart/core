import AppLogo from './app-logo';
import AppLogoIcon from './app-logo-icon';

export default function AppLogoSwitcher() {
    return (
        <div className="flex items-center justify-start">
            {/* Mobile and tablet: logo */}
            <div className="block md:hidden">
                <AppLogo size="md" />
            </div>

            {/* Desktop: only logo when expanded */}
            <div className="hidden group-data-[state=collapsed]:hidden group-data-[state=expanded]:block md:block">
                <AppLogo size="md" />
            </div>

            {/* Desktop: only icon when collapsed */}
            <div className="hidden aspect-square size-8 items-center justify-center rounded-md group-data-[state=collapsed]:flex group-data-[state=expanded]:hidden md:flex">
                <AppLogoIcon className="size-5" />
            </div>
        </div>
    );
}
