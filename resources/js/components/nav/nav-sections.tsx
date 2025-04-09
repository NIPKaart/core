import { NavSection } from '@/components/nav/nav-section';
import { NavGroup } from '@/types';

export function NavSections({ groups }: { groups: NavGroup[] }) {
    return (
        <>
            {groups.map((group) => (
                <NavSection key={group.title} group={group} />
            ))}
        </>
    );
}
