import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@modl-gg/shared-web/components/ui/dialog';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { Input } from '@modl-gg/shared-web/components/ui/input';
import { Label } from '@modl-gg/shared-web/components/ui/label';
import { Switch } from '@modl-gg/shared-web/components/ui/switch';
import { Textarea } from '@modl-gg/shared-web/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { serversService, type AdminServerDetails } from '@/lib/services/servers-service';
import {
  PROVISIONING_STATUSES,
  SERVER_PLANS,
  SUBSCRIPTION_STATUSES,
} from '@/lib/services/server-status';
import { useSingleFlight } from '@/hooks/useSingleFlight';
import { capitalizeFirst, describeError } from '@/lib/utils';

const keepSubscriptionStatus = 'keep-current';

const editServerSchema = z.object({
  adminEmail: z.string().email('Invalid email address'),
  plan: z.enum(SERVER_PLANS),
  emailVerified: z.boolean(),
  provisioningStatus: z.enum(PROVISIONING_STATUSES),
  subscriptionStatus: z.enum([keepSubscriptionStatus, ...SUBSCRIPTION_STATUSES] as const),
  provisioningNotes: z.string().max(1000, 'Notes must be at most 1000 characters'),
});

type EditServerFormValues = z.infer<typeof editServerSchema>;

function statusLabel(value: string): string {
  return capitalizeFirst(value.replace(/[_-]/g, ' '));
}

function toFormValues(server: AdminServerDetails | null): EditServerFormValues {
  return {
    adminEmail: server?.adminEmail ?? '',
    plan: server?.plan ?? 'free',
    emailVerified: server?.emailVerified ?? false,
    provisioningStatus: server?.provisioningStatus ?? 'pending',
    subscriptionStatus: server?.subscriptionStatus ?? keepSubscriptionStatus,
    provisioningNotes: server?.provisioningNotes ?? '',
  };
}

interface EditServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: AdminServerDetails | null;
}

export function EditServerModal({ isOpen, onClose, server }: EditServerModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<EditServerFormValues>({
    resolver: zodResolver(editServerSchema),
    defaultValues: toFormValues(server),
  });

  const mutation = useMutation({
    mutationFn: (data: EditServerFormValues) => {
      if (!server) {
        throw new Error('No server selected');
      }

      return serversService.updateServer(server.id, {
        adminEmail: data.adminEmail,
        plan: data.plan,
        emailVerified: data.emailVerified,
        provisioningStatus: data.provisioningStatus,
        subscriptionStatus:
          data.subscriptionStatus === keepSubscriptionStatus ? undefined : data.subscriptionStatus,
        provisioningNotes: data.provisioningNotes.trim(),
      });
    },
    onSuccess: () => {
      if (server?.id) {
        queryClient.invalidateQueries({ queryKey: ['server', server.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      onClose();
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset(toFormValues(server));
      mutation.reset();
    }
  }, [isOpen]);

  const onSubmit = useSingleFlight((data: EditServerFormValues) => mutation.mutateAsync(data));

  if (!server) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Server</DialogTitle>
          <DialogDescription>
            Update editable server fields. Immutable fields are shown for context.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="serverName">Server Name</Label>
            <Input id="serverName" value={server.serverName} readOnly disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customDomain">Subdomain</Label>
            <Input id="customDomain" value={server.customDomain} readOnly disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminEmail">Admin Email</Label>
            <Input id="adminEmail" {...form.register('adminEmail')} />
            {form.formState.errors.adminEmail && (
              <p className="text-sm text-destructive">{form.formState.errors.adminEmail.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="emailVerified">Email Verified</Label>
            <Switch
              id="emailVerified"
              checked={form.watch('emailVerified')}
              onCheckedChange={(checked: boolean) =>
                form.setValue('emailVerified', checked, { shouldDirty: true })
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <select id="plan" {...form.register('plan')} className="w-full p-2 border rounded-md">
                {SERVER_PLANS.map((plan) => (
                  <option key={plan} value={plan}>
                    {statusLabel(plan)}
                  </option>
                ))}
              </select>
              {form.formState.errors.plan && (
                <p className="text-sm text-destructive">{form.formState.errors.plan.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="provisioningStatus">Provisioning Status</Label>
              <select
                id="provisioningStatus"
                {...form.register('provisioningStatus')}
                className="w-full p-2 border rounded-md"
              >
                {PROVISIONING_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
              {form.formState.errors.provisioningStatus && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.provisioningStatus.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subscriptionStatus">Subscription Status</Label>
            <select
              id="subscriptionStatus"
              {...form.register('subscriptionStatus')}
              className="w-full p-2 border rounded-md"
            >
              <option value={keepSubscriptionStatus}>Keep current</option>
              {SUBSCRIPTION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
            {form.formState.errors.subscriptionStatus && (
              <p className="text-sm text-destructive">
                {form.formState.errors.subscriptionStatus.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="provisioningNotes">Provisioning Notes</Label>
            <Textarea
              id="provisioningNotes"
              className="min-h-[80px]"
              placeholder="Internal notes about this server's provisioning..."
              {...form.register('provisioningNotes')}
            />
            {form.formState.errors.provisioningNotes && (
              <p className="text-sm text-destructive">
                {form.formState.errors.provisioningNotes.message}
              </p>
            )}
          </div>

          {mutation.isError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">Failed to update server</p>
              <p className="text-sm text-muted-foreground">
                {describeError(mutation.error, 'Unexpected error')}
              </p>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
