import { usePage } from '@inertiajs/react';

type AuthUser = {
    id: number;
    name: string;
    email: string;
};

type AuthProps = {
    user: AuthUser | null;
    roles: string[];
    can: Record<string, boolean>;
};

type InertiaPageProps = {
    auth: AuthProps;
};

export function useAuthorization() {
    const { auth } = usePage<InertiaPageProps>().props;

    const can = (permission: string): boolean => {
        return auth?.can?.[permission] === true;
    };

    const hasRole = (roles: string | string[]): boolean => {
        if (!auth?.roles) return false;

        const roleList = Array.isArray(roles) ? roles : [roles];
        return roleList.some((role) => auth.roles.includes(role));
    };

    return { can, hasRole, user: auth.user };
}
