import Features from '@/components/frontend/features';
import Footer from '@/components/frontend/footer';
import Hero from '@/components/frontend/hero';
import FrontendLayout from '@/layouts/frontend-layout';
import { Head } from '@inertiajs/react';

export default function Home() {
    return (
        <FrontendLayout>
            <Head title="Home" />
            <Hero />
            <Features />
            <Footer />
        </FrontendLayout>
    );
}
