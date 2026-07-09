import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@modl-gg/shared-web/components/ui/dialog';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { Input } from '@modl-gg/shared-web/components/ui/input';
import { Label } from '@modl-gg/shared-web/components/ui/label';
import { useToast } from '@modl-gg/shared-web/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { betaTestersService } from '@/lib/services/beta-testers-service';
import { useSingleFlight } from '@/hooks/useSingleFlight';
import { describeError } from '@/lib/utils';

const subdomainPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const createBetaTesterSchema = z.object({
  serverName: z
    .string()
    .trim()
    .min(2, 'Server name must be at least 2 characters')
    .max(64, 'Server name must be at most 64 characters'),
  customDomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(50, 'Subdomain must be at most 50 characters')
    .regex(subdomainPattern, 'Use lowercase letters, numbers, and hyphens only'),
  adminEmail: z.string().trim().email('Enter a valid email address'),
});

type CreateBetaTesterFormValues = z.infer<typeof createBetaTesterSchema>;

const defaultValues: CreateBetaTesterFormValues = {
  serverName: '',
  customDomain: '',
  adminEmail: '',
};

interface CreateBetaTesterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateBetaTesterModal({ isOpen, onClose }: CreateBetaTesterModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<CreateBetaTesterFormValues>({
    resolver: zodResolver(createBetaTesterSchema),
    defaultValues,
  });

  const mutation = useMutation({
    mutationFn: (values: CreateBetaTesterFormValues) =>
      betaTestersService.createBetaTester(values),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['beta-testers'] });
      toast({
        title: 'Beta tester provisioned',
        description: `${record.serverName} is now live at ${record.customDomain}.modl.top`,
      });
      onClose();
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset(defaultValues);
      mutation.reset();
    }
  }, [isOpen]);

  const subdomainPreview = form.watch('customDomain');

  const onSubmit = useSingleFlight((values: CreateBetaTesterFormValues) =>
    mutation.mutateAsync(values),
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Create beta tester
          </DialogTitle>
          <DialogDescription>
            Provisions a fully-featured panel with Premium granted for free and strict beta resource
            limits. Available on staging only.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="serverName">Server name</Label>
            <Input id="serverName" placeholder="Hypixel" {...form.register('serverName')} />
            {form.formState.errors.serverName && (
              <p className="text-sm text-destructive">{form.formState.errors.serverName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customDomain">Subdomain</Label>
            <div className="flex items-center gap-2">
              <Input
                id="customDomain"
                placeholder="hypixel"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                {...form.register('customDomain')}
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">.modl.top</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Panel URL:{' '}
              <span className="font-mono text-foreground">
                {(subdomainPreview || 'subdomain').toLowerCase()}.modl.top
              </span>
            </p>
            {form.formState.errors.customDomain && (
              <p className="text-sm text-destructive">{form.formState.errors.customDomain.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminEmail">Admin email</Label>
            <Input
              id="adminEmail"
              type="email"
              placeholder="admin@example.com"
              {...form.register('adminEmail')}
            />
            {form.formState.errors.adminEmail && (
              <p className="text-sm text-destructive">{form.formState.errors.adminEmail.message}</p>
            )}
          </div>

          {mutation.isError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">Failed to create beta tester</p>
              <p className="text-sm text-muted-foreground">
                {describeError(mutation.error, 'Unexpected error')}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Provisioning...' : 'Create beta tester'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
