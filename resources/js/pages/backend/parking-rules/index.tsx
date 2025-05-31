import { ConfirmDialog } from '@/components/confirm-dialog';
import ParkingRuleModal from '@/components/modals/modal-parking-rule';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, Country, PaginatedResponse, ParkingRule } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormValues } from '../form-parking-rules';
import { getParkingRuleColumns } from './columns';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Parking Rules',
        href: route('app.parking-rules.index'),
    },
];

type PageProps = {
    parkingRules: PaginatedResponse<ParkingRule>;
    countries: Country[];
    municipalities: string[];
};

export default function Index({ parkingRules, countries, municipalities }: PageProps) {
    const { can } = useAuthorization();

    // ADD Dialog/Drawer
    const [openAdd, setOpenAdd] = useState(false);
    const formAdd = useForm<FormValues>({
        defaultValues: {
            country_id: '',
            municipality: '',
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
            municipality: '',
            url: '',
            nationwide: false,
        },
    });

    function openEditDialog(rule: ParkingRule) {
        setEditRule(rule);
        formEdit.reset({
            country_id: String(rule.country_id),
            municipality: rule.municipality,
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
                toast.success('Parking Rule added successfully!');
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
                toast.success('Parking Rule updated successfully!');
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
            onSuccess: () => toast.success('Parking Rule deleted successfully'),
            onError: () => toast.error('Failed to delete parking rule'),
        });
    };

    const columns = getParkingRuleColumns(can, openEditDialog, openDeleteDialog);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Parking Rules" />
            <div className="space-y-6 px-4 py-6 sm:px-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Parking Rules</h1>
                    {can('parking-rule.create') && (
                        <Button className="cursor-pointer" variant="outline" onClick={() => setOpenAdd(true)}>
                            <Plus className="mr-1 h-4 w-4" />
                            Parking Rule
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
                municipalities={municipalities}
                isEdit
                onSubmit={handleEditSubmit}
                submitting={formEdit.formState.isSubmitting}
            />

            {/* DELETE Dialog */}
            {dialogParkingRule && dialogType === 'delete' && (
                <ConfirmDialog
                    title="Delete parking rule?"
                    description={`Are you sure you want to delete the rule for: ${dialogParkingRule.country?.name} (${dialogParkingRule.country?.code}), ${dialogParkingRule.municipality}?`}
                    confirmText="Delete"
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
