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
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormValues } from '../form-parking-rules';
import { getParkingRuleColumns } from './columns';

type PageProps = {
    parkingRules: PaginatedResponse<ParkingRule>;
    countries: Country[];
    municipalities: Municipality[];
};

export default function Index({ parkingRules, countries, municipalities }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('parking-rules');
    const { can } = useAuthorization();

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('breadcrumbs.index'),
            href: route('app.parking-rules.index'),
        },
    ];

    // ADD Dialog/Drawer
    const [openAdd, setOpenAdd] = useState(false);
    const formAdd = useForm<FormValues>({
        defaultValues: {
            country_id: '',
            municipality_id: '',
            url: '',
            nationwide: false,
        },
    });

    // EDIT Dialog/Drawer
    const [openEdit, setOpenEdit] = useState(false);
    const [editRule, setEditRule] = useState<ParkingRule | null>(null);
    const formEdit = useForm<FormValues>({
        defaultValues: {
            country_id: '',
            municipality_id: '',
            url: '',
            nationwide: false,
        },
    });

    function openEditDialog(rule: ParkingRule) {
        setEditRule(rule);
        formEdit.reset({
            country_id: String(rule.country_id),
            municipality_id: String(rule.municipality_id),
            url: rule.url,
            nationwide: rule.nationwide,
        });
        setOpenEdit(true);
    }

    function handleAddClose() {
        formAdd.reset();
        setOpenAdd(false);
    }

    function handleEditClose() {
        formEdit.reset();
        setOpenEdit(false);
    }

    // DELETE Dialog
    const [dialogParkingRule, setDialogParkingRule] = useState<ParkingRule | null>(null);
    const [dialogType, setDialogType] = useState<'delete' | null>(null);
    const openDeleteDialog = (rule: ParkingRule) => {
        setDialogParkingRule(rule);
        setDialogType('delete');
    };

    const handleAddSubmit = formAdd.handleSubmit((data) => {
        router.post(route('app.parking-rules.store'), data, {
            preserveScroll: true,
            onSuccess: () => {
                setOpenAdd(false);
                formAdd.reset();
                toast.success(t('toasts.created'));
            },
            onError: (errors) => {
                Object.entries(errors).forEach(([field, message]) => {
                    formAdd.setError(field as keyof FormValues, {
                        type: 'server',
                        message: message as string,
                    });
                });
            },
        });
    });

    const handleEditSubmit = formEdit.handleSubmit((data) => {
        if (!editRule) return;
        router.put(route('app.parking-rules.update', { id: editRule.id }), data, {
            preserveScroll: true,
            onSuccess: () => {
                setOpenEdit(false);
                setEditRule(null);
                toast.success(t('toasts.updated'));
            },
            onError: (errors) => {
                Object.entries(errors).forEach(([field, message]) => {
                    formEdit.setError(field as keyof FormValues, {
                        type: 'server',
                        message: message as string,
                    });
                });
            },
        });
    });

    const deleteParkingRule = (id: number) => {
        router.delete(route('app.parking-rules.destroy', { id }), {
            onSuccess: () => toast.success(t('toasts.deleted')),
            onError: () => toast.error(t('toasts.error')),
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

                <DataTable columns={columns} data={parkingRules.data} />
                <DataTablePagination pagination={parkingRules} />
            </div>

            {/* ADD Dialog/Drawer */}
            <ParkingRuleModal
                open={openAdd}
                onClose={handleAddClose}
                form={formAdd}
                countries={countries}
                municipalities={municipalities}
                isEdit={false}
                onSubmit={handleAddSubmit}
                submitting={formAdd.formState.isSubmitting}
            />

            {/* EDIT Dialog/Drawer */}
            <ParkingRuleModal
                open={openEdit}
                onClose={handleEditClose}
                form={formEdit}
                countries={countries}
                municipalities={editMunicipalities}
                isEdit
                onSubmit={handleEditSubmit}
                submitting={formEdit.formState.isSubmitting}
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
