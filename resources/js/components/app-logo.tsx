import { ImgHTMLAttributes } from 'react';

interface AppLogoProps extends ImgHTMLAttributes<HTMLImageElement> {
    size?: 'sm' | 'md' | 'lg';
    forceDark?: boolean;
    forceLight?: boolean;
}

export default function AppLogo({ size = 'md', className = '', forceDark, forceLight, ...props }: AppLogoProps) {
    const heightClass = {
        sm: 'h-6',
        md: 'h-8',
        lg: 'h-10',
    }[size];

    const sharedClass = `w-auto ${heightClass} ${className}`;

    const showAuto = !forceDark && !forceLight;
    const logoSrc = forceDark ? '/assets/images/logo-dark.svg' : forceLight ? '/assets/images/logo-light.svg' : null;

    if (!showAuto && logoSrc) {
        return <img {...props} src={logoSrc} alt="NIPKaart logo" className={`block ${sharedClass}`} />;
    }

    // Automatic theme-switching
    return (
        <>
            <img {...props} src="/assets/images/logo-light.svg" alt="NIPKaart logo" className={`block dark:hidden ${sharedClass}`} />
            <img {...props} src="/assets/images/logo-dark.svg" alt="NIPKaart logo" className={`hidden dark:block ${sharedClass}`} />
        </>
    );
}
