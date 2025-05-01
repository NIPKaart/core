import { ImgHTMLAttributes } from 'react';

export default function AppLogoIcon(props: ImgHTMLAttributes<HTMLImageElement>) {
    return <img {...props} src="/assets/images/logo-icon.svg" alt="NIPKaart icon" />;
}
