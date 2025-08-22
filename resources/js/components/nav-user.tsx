import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import { useMediaQuery } from '@/hooks/use-media-query';
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { EllipsisVertical } from 'lucide-react';
import { useState } from 'react';
import AboutResponsive from './modals/modal-about-dialog';

export function NavUser() {
    const { auth } = usePage<SharedData>().props;
    const { state } = useSidebar();
    const isMobile = useMediaQuery();
    const [aboutOpen, setAboutOpen] = useState(false);

    return (
        <>
            <SidebarMenu>
                <SidebarMenuItem>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <SidebarMenuButton
                                size="lg"
                                className="group cursor-pointer text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent"
                            >
                                <UserInfo user={auth.user} />
                                <EllipsisVertical className="ml-auto size-4" />
                            </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                            align="end"
                            side={isMobile ? 'bottom' : state === 'collapsed' ? 'left' : 'bottom'}
                        >
                            <UserMenuContent user={auth.user} onOpenAbout={() => setAboutOpen(true)} />
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>

            <AboutResponsive open={aboutOpen} onOpenChange={setAboutOpen} />
        </>
    );
}
