import { ConfirmDialog } from '@/components/confirm-dialog';
import ParkingRuleModal from '@/components/modals/modal-parking-rule';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, Country, Municipality, PaginatedResponse, ParkingRule } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FormValues } from '../form-parking-rules';
import { getParkingRuleColumns } from './columns';

type PageProps = {
    parkingRules: PaginatedResponse<ParkingRule>;
    countries: Country[];
    municipalities: Municipality[];
};

export default function Index({ parkingRules, countries, municipalities }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/parking-rules');
    const { can } = useAuthorization();

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('breadcrumbs.index'),
            href: route('app.parking-rules.index'),
        },
    ];

    // ADD Dialog/Drawer
    const [openAdd, setOpenAdd] = useState(false);

    // EDIT Dialog/Drawer
    const [openEdit, setOpenEdit] = useState(false);
    const [editRule, setEditRule] = useState<ParkingRule | null>(null);

    function openEditDialog(rule: ParkingRule) {
        setEditRule(rule);
        setOpenEdit(true);
    }

    function handleAddClose() {
        setOpenAdd(false);
    }

    function handleEditClose() {
        setOpenEdit(false);
        setEditRule(null);
    }

    // DELETE Dialog
    const [dialogParkingRule, setDialogParkingRule] = useState<ParkingRule | null>(null);
    const [dialogType, setDialogType] = useState<'delete' | null>(null);
    const openDeleteDialog = (rule: ParkingRule) => {
        setDialogParkingRule(rule);
        setDialogType('delete');
    };

    const deleteParkingRule = (id: number) => {
        router.delete(route('app.parking-rules.destroy', { id }), {
            onSuccess: () => toast.success(t('toasts.deleted')),
            onError: () => toast.error(t('toasts.error')),
            preserveScroll: true,
        });
    };

    const columns = getParkingRuleColumns(can, openEditDialog, openDeleteDialog, { t, tGlobal });

    // Memoize the municipalities to include the one being edited if applicable
    const editMunicipalities = useMemo(() => {
        if (!editRule) return municipalities;
        const currentId = String(editRule.municipality_id);
        const alreadyIncluded = municipalities.some((m) => String(m.id) === currentId);
        if (!alreadyIncluded && editRule.municipality) {
            return [...municipalities, editRule.municipality];
        }
        return municipalities;
    }, [municipalities, editRule]);

    // Initial values for the add and edit forms
    const initialAdd: Partial<FormValues> = {
        country_id: '',
        municipality_id: '',
        url: '',
        nationwide: false,
    };

    // If editing, set initial values based on the rule being edited
    const initialEdit: Partial<FormValues> | undefined = editRule
        ? {
              country_id: String(editRule.country_id ?? ''),
              municipality_id: String(editRule.municipality_id ?? ''),
              url: editRule.url ?? '',
              nationwide: Boolean(editRule.nationwide),
          }
        : undefined;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.title')} />
            <div className="space-y-6 overflow-x-auto px-4 py-6 sm:px-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">{t('head.title')}</h1>
                    {can('parking-rule.create') && (
                        <Button className="cursor-pointer" variant="outline" onClick={() => setOpenAdd(true)}>
                            <Plus className="h-4 w-4" />
                            {t('buttons.add')}
                        </Button>
                    )}
                </div>
                <p className="text-muted-foreground">{t('head.description')}</p>

                <DataTable columns={columns} data={parkingRules.data} />
                <DataTablePagination pagination={parkingRules} />
            </div>

            {/* ADD Dialog/Drawer */}
            <ParkingRuleModal
                open={openAdd}
                onClose={handleAddClose}
                isEdit={false}
                countries={countries}
                municipalities={municipalities}
                action={route('app.parking-rules.store')}
                method="post"
                initial={initialAdd}
                onSuccess={() => {
                    setOpenAdd(false);
                    toast.success(t('toasts.created'));
                }}
            />

            {/* EDIT Dialog/Drawer */}
            <ParkingRuleModal
                open={openEdit}
                onClose={handleEditClose}
                isEdit
                countries={countries}
                municipalities={editMunicipalities}
                action={editRule ? route('app.parking-rules.update', { id: editRule.id }) : '#'}
                method="put"
                initial={initialEdit}
                onSuccess={() => {
                    setOpenEdit(false);
                    setEditRule(null);
                    toast.success(t('toasts.updated'));
                }}
            />

            {/* DELETE Dialog */}
            {dialogParkingRule && dialogType === 'delete' && (
                <ConfirmDialog
                    title={t('confirm.delete_title')}
                    description={t('confirm.delete_description', {
                        country: dialogParkingRule.country?.name,
                        code: dialogParkingRule.country?.code,
                        municipality: dialogParkingRule.municipality?.name,
                    })}
                    confirmText={tGlobal('common.delete')}
                    cancelText={tGlobal('common.cancel')}
                    variant="destructive"
                    onConfirm={() => {
                        deleteParkingRule(dialogParkingRule.id);
                        setDialogParkingRule(null);
                        setDialogType(null);
                    }}
                    onClose={() => {
                        setDialogParkingRule(null);
                        setDialogType(null);
                    }}
                />
            )}
        </AppLayout>
    );
}
