export default function Footer() {
    return (
        <footer className="border-t border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center justify-center gap-2 text-sm text-gray-600 sm:flex-row sm:justify-between dark:text-gray-300">
                    <span>&copy; {new Date().getFullYear()} NIPKaart. All rights reserved.</span>
                    <span>Made with ❤️ by the NIPKaart</span>
                </div>
            </div>
        </footer>
    );
}
