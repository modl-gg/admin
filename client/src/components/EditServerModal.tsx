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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { serversService, type AdminServerDetails, type ServerPlan } from '@/lib/services/servers-service';

const editServerSchema = z.object({
  adminEmail: z.string().email('Invalid email address'),
  plan: z.enum(['free', 'premium']),
});

type EditServerFormValues = z.infer<typeof editServerSchema>;

interface EditServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: AdminServerDetails | null;
}

export function EditServerModal({ isOpen, onClose, server }: EditServerModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<EditServerFormValues>({
    resolver: zodResolver(editServerSchema),
    defaultValues: {
      adminEmail: server?.adminEmail ?? '',
      plan: server?.plan ?? 'free',
    },
    values: {
      adminEmail: server?.adminEmail ?? '',
      plan: server?.plan ?? 'free',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: EditServerFormValues) => {
      if (!server) {
        throw new Error('No server selected');
      }

      return serversService.updateServer(server.id, {
        adminEmail: data.adminEmail,
        plan: data.plan as ServerPlan,
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

  const onSubmit = (data: EditServerFormValues) => {
    mutation.mutate(data);
  };

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

          <div className="space-y-2">
            <Label htmlFor="plan">Plan</Label>
            <select id="plan" {...form.register('plan')} className="w-full p-2 border rounded-md">
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
            {form.formState.errors.plan && (
              <p className="text-sm text-destructive">{form.formState.errors.plan.message}</p>
            )}
          </div>

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
