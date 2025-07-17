import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
  } from 'modl-shared-web/components/ui/dialog';
  import { Button } from 'modl-shared-web/components/ui/button';
  import { Input } from 'modl-shared-web/components/ui/input';
  import { Label } from 'modl-shared-web/components/ui/label';
  import { useForm } from 'react-hook-form';
  import { zodResolver } from '@hookform/resolvers/zod';
  import { z } from 'zod';
  import { apiClient } from '@/lib/api';
  import { useMutation, useQueryClient } from '@tanstack/react-query';
  
  const editServerSchema = z.object({
    serverName: z.string().min(1, 'Server name is required'),
    adminEmail: z.string().email('Invalid email address'),
    customDomain: z.string().optional(),
    plan: z.enum(['free', 'premium']),
  });
  
  type EditServerFormValues = z.infer<typeof editServerSchema>;
  
  interface EditServerModalProps {
    isOpen: boolean;
    onClose: () => void;
    server: {
      _id: string;
      serverName: string;
      adminEmail: string;
      customDomain?: string;
      plan: 'free' | 'premium';
    } | null;
  }
  
  export function EditServerModal({ isOpen, onClose, server }: EditServerModalProps) {
    const queryClient = useQueryClient();
    const form = useForm<EditServerFormValues>({
      resolver: zodResolver(editServerSchema),
      defaultValues: {
        serverName: server?.serverName || '',
        adminEmail: server?.adminEmail || '',
        customDomain: server?.customDomain || '',
        plan: server?.plan || 'free',
      },
    });
  
    const mutation = useMutation({
      mutationFn: (data: EditServerFormValues) => {
        if (!server) throw new Error('No server selected');
        return apiClient.updateServer(server._id, data);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['server', server?._id] });
        queryClient.invalidateQueries({ queryKey: ['servers'] });
        onClose();
      },
    });
  
    const onSubmit = (data: EditServerFormValues) => {
      mutation.mutate(data);
    };
  
    if (!server) return null;
  
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Server</DialogTitle>
            <DialogDescription>
              Make changes to the server configuration.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serverName">Server Name</Label>
              <Input id="serverName" {...form.register('serverName')} />
              {form.formState.errors.serverName && (
                <p className="text-sm text-destructive">{form.formState.errors.serverName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin Email</Label>
              <Input id="adminEmail" {...form.register('adminEmail')} />
              {form.formState.errors.adminEmail && (
                <p className="text-sm text-destructive">{form.formState.errors.adminEmail.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="customDomain">Subdomain</Label>
              <Input id="customDomain" {...form.register('customDomain')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <select id="plan" {...form.register('plan')} className="w-full p-2 border rounded-md">
                <option value="free">Free</option>
                <option value="premium">Premium</option>
              </select>
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