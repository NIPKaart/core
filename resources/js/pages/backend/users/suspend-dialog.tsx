import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import app from '@/routes/app';
import type { User } from '@/types';
import { useForm } from '@inertiajs/react';
import { toast } from 'sonner';

const REASON_MAX_LENGTH = 500;

export function SuspendDialog({ user, onClose }: { user: User; onClose: () => void }) {
    const { t, tGlobal } = useResourceTranslation('backend/users');
    const form = useForm({ reason: '' });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.submit(app.users.suspend({ id: user.id }), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(t('toast.suspended'));
                onClose();
            },
        });
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{t('confirm.suspend.title')}</DialogTitle>
                        <DialogDescription>{t('confirm.suspend.description', { name: user.name })}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="suspension-reason">{t('confirm.suspend.reason')}</Label>
                        <Textarea
                            id="suspension-reason"
                            value={form.data.reason}
                            onChange={(event) => form.setData('reason', event.target.value)}
                            maxLength={REASON_MAX_LENGTH}
                            required
                            rows={4}
                            aria-invalid={!!form.errors.reason}
                        />
                        <p className="text-xs text-muted-foreground">{t('confirm.suspend.reason_help', { max: REASON_MAX_LENGTH })}</p>
                        <InputError message={form.errors.reason} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            {tGlobal('common.cancel')}
                        </Button>
                        <Button type="submit" variant="destructive" disabled={form.processing || form.data.reason.trim() === ''}>
                            {t('confirm.suspend.confirm')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
