import { NavGroup } from "@/types";
import { NavSection } from "@/components/nav/nav-section";

export function NavSections({ groups }: { groups: NavGroup[] }) {
    return (
        <>
            {groups.map((group) => (
                <NavSection key={group.title} group={group} />
            ))}
        </>
    )
}