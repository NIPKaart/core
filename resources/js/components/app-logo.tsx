import { ImgHTMLAttributes } from 'react';

interface AppLogoProps extends ImgHTMLAttributes<HTMLImageElement> {
    size?: 'sm' | 'md' | 'lg';
}

export default function AppLogo({ size = 'md', className = '', ...props }: AppLogoProps) {
    const heightClass = size === 'sm' ? 'h-6' : size === 'lg' ? 'h-10' : 'h-8';

    return (
        <>
            <img
                {...props}
                src="/assets/images/logo-light.svg"
                alt="NIPKaart logo"
                className={`block w-auto dark:hidden ${heightClass} ${className}`}
            />
            <img
                {...props}
                src="/assets/images/logo-dark.svg"
                alt="NIPKaart logo"
                className={`hidden w-auto dark:block ${heightClass} ${className}`}
            />
        </>
    );
}
