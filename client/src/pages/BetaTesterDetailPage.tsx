import { useParams, useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@modl-gg/shared-web/components/ui/card';
import { Badge } from '@modl-gg/shared-web/components/ui/badge';
import { Progress } from '@modl-gg/shared-web/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@modl-gg/shared-web/components/ui/alert-dialog';
import { useToast } from '@modl-gg/shared-web/hooks/use-toast';
import {
  ArrowLeft,
  FlaskConical,
  CheckCircle,
  XCircle,
  RotateCcw,
  Ban,
  HardDrive,
  Sparkles,
  Cloud,
  Users,
  Globe,
  Upload,
  KeyRound,
  History,
} from 'lucide-react';
import { betaTestersService } from '@/lib/services/beta-testers-service';
import {
  type BetaAuditEntry,
  type BetaTesterRecord,
} from '@/lib/api-contracts/beta-testers';
import { formatBytes, formatDate, formatDateRelative } from '@/lib/utils';

function formatGigabytes(value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} GB`;
}

function toPercent(used: number, limit: number): number {
  if (limit <= 0) {
    return used > 0 ? 100 : 0;
  }

  return Math.min(100, Math.round((used / limit) * 100));
}

function humanizeAction(action: string): string {
  return action
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getActionBadgeVariant(action: string): 'success' | 'destructive' | 'info' | 'outline' {
  const normalized = action.toLowerCase();
  if (normalized.includes('create')) return 'success';
  if (normalized.includes('revoke')) return 'destructive';
  if (normalized.includes('reset')) return 'info';
  return 'outline';
}

interface UsageMeterProps {
  icon: React.ReactNode;
  label: string;
  usedLabel: string;
  limitLabel: string;
  percent: number;
}

function UsageMeter({ icon, label, usedLabel, limitLabel, percent }: UsageMeterProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium">
          {icon}
          {label}
        </span>
        <span className="text-muted-foreground">
          <span className="text-foreground font-medium">{usedLabel}</span> / {limitLabel}
        </span>
      </div>
      <Progress value={percent} />
    </div>
  );
}

function AuditRow({ entry }: { entry: BetaAuditEntry }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b last:border-b-0">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant={getActionBadgeVariant(entry.action)}>{humanizeAction(entry.action)}</Badge>
          <span className="text-sm text-muted-foreground">{entry.adminEmail}</span>
        </div>
        {entry.details && <p className="text-sm text-muted-foreground">{entry.details}</p>}
      </div>
      {entry.timestamp && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateRelative(entry.timestamp)}
        </span>
      )}
    </div>
  );
}

export default function BetaTesterDetailPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isValidId = Boolean(id && id !== 'undefined' && id !== 'null');

  const {
    data: record,
    isLoading,
    error,
  } = useQuery<BetaTesterRecord>({
    queryKey: ['beta-tester', id],
    queryFn: () => betaTestersService.getBetaTester(id!),
    enabled: isValidId,
  });

  const { data: audit } = useQuery({
    queryKey: ['beta-tester-audit', id],
    queryFn: () => betaTestersService.getBetaTesterAudit(id!),
    enabled: isValidId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['beta-tester', id] });
    queryClient.invalidateQueries({ queryKey: ['beta-tester-audit', id] });
    queryClient.invalidateQueries({ queryKey: ['beta-testers'] });
  };

  const resetMutation = useMutation({
    mutationFn: (serverId: string) => betaTestersService.resetBetaTester(serverId),
    onSuccess: (result) => {
      refresh();
      toast({
        title: 'Panel reset',
        description: `Cleared ${result.clearedCollections.length} collection${
          result.clearedCollections.length === 1 ? '' : 's'
        } and zeroed usage counters.`,
      });
    },
    onError: (mutationError) => {
      toast({
        title: 'Reset failed',
        description: mutationError instanceof Error ? mutationError.message : 'Unexpected error',
        variant: 'destructive',
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (serverId: string) => betaTestersService.revokeBetaTester(serverId),
    onSuccess: (revoked) => {
      refresh();
      toast({
        title: 'Beta access revoked',
        description: `${revoked.serverName} is locked out. Data is retained for auditing.`,
      });
    },
    onError: (mutationError) => {
      toast({
        title: 'Revoke failed',
        description: mutationError instanceof Error ? mutationError.message : 'Unexpected error',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isValidId || error || !record) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="text-center py-12">
            <FlaskConical className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Beta tester not found</h3>
            <p className="text-muted-foreground mb-6">
              {!isValidId ? 'Invalid beta tester ID provided.' : 'This beta tester could not be loaded.'}
            </p>
            <Button variant="outline" onClick={() => navigate('/beta-testers')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Beta Testing
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const auditEntries = audit?.entries ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2 text-muted-foreground"
          onClick={() => navigate('/beta-testers')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Beta Testing
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{record.serverName}</h1>
              <a
                href={`https://${record.customDomain}.modl.top`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-muted-foreground font-mono hover:text-primary transition-colors"
              >
                {record.customDomain}.modl.top
              </a>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {record.plan === 'premium' && <Badge className="bg-purple-500">Premium</Badge>}
            {record.betaTester ? (
              <Badge variant="info">Beta Tester</Badge>
            ) : (
              <Badge variant="destructive">Revoked</Badge>
            )}
            {record.provisioningStatus === 'completed' ? (
              <Badge variant="success">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="outline">{record.provisioningStatus}</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={!record.betaTester || resetMutation.isPending}>
              <RotateCcw className="h-4 w-4 mr-2" />
              {resetMutation.isPending ? 'Resetting...' : 'Reset Panel'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset this panel?</AlertDialogTitle>
              <AlertDialogDescription>
                This clears all accumulated data (players, tickets, chat logs, replays, uploads) and
                zeroes usage counters for{' '}
                <span className="font-medium text-foreground">{record.serverName}</span>. Staff, roles,
                settings, knowledgebase, and passkeys are preserved. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  resetMutation.mutate(record.id);
                }}
              >
                Confirm Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={!record.betaTester || revokeMutation.isPending}>
              <Ban className="h-4 w-4 mr-2" />
              {revokeMutation.isPending ? 'Revoking...' : 'Revoke Access'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke beta access?</AlertDialogTitle>
              <AlertDialogDescription>
                This locks{' '}
                <span className="font-medium text-foreground">{record.serverName}</span> out of their
                panel and downgrades them to Free. All data is retained for auditing and the action is
                reversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  revokeMutation.mutate(record.id);
                }}
              >
                Confirm Revoke
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Server Information</CardTitle>
          <CardDescription>Provisioning details and beta lifecycle</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Admin Email</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{record.adminEmail}</p>
                  {record.emailVerified ? (
                    <Badge variant="success">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="warning">
                      <XCircle className="h-3 w-3 mr-1" />
                      Unverified
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">API Key</p>
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  {record.apiKeySet ? (
                    <Badge variant="success">Configured</Badge>
                  ) : (
                    <Badge variant="warning">Not set</Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Subscription Status</p>
                <p className="font-medium capitalize">{record.subscriptionStatus ?? 'unknown'}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Beta Granted</p>
                <p className="font-medium">
                  {record.betaTesterCreatedAt ? formatDate(record.betaTesterCreatedAt) : 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Granted By</p>
                <p className="font-medium">{record.betaTesterCreatedBy ?? 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p className="font-medium">
                  {record.createdAt ? formatDate(record.createdAt) : 'Unknown'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage vs. Beta Limits</CardTitle>
          <CardDescription>Metered resources against the strict beta caps</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-5">
            <UsageMeter
              icon={<HardDrive className="h-4 w-4 text-muted-foreground" />}
              label="Storage"
              usedLabel={formatBytes(record.usage.storageUsedBytes)}
              limitLabel={formatBytes(record.limits.maxStorageBytes)}
              percent={toPercent(record.usage.storageUsedBytes, record.limits.maxStorageBytes)}
            />
            <UsageMeter
              icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
              label="AI Requests"
              usedLabel={record.usage.aiRequestsUsed.toLocaleString()}
              limitLabel={record.limits.aiRequestLimit.toLocaleString()}
              percent={toPercent(record.usage.aiRequestsUsed, record.limits.aiRequestLimit)}
            />
            <UsageMeter
              icon={<Cloud className="h-4 w-4 text-muted-foreground" />}
              label="CDN Egress"
              usedLabel={formatGigabytes(record.usage.cdnUsageGb)}
              limitLabel={formatGigabytes(record.limits.cdnLimitGb)}
              percent={toPercent(record.usage.cdnUsageGb, record.limits.cdnLimitGb)}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                Staff Seats
              </p>
              <p className="text-lg font-semibold">Up to {record.limits.maxStaffSeats}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Custom Domain
              </p>
              <p className="text-lg font-semibold">
                {record.limits.customDomainAllowed ? 'Allowed' : 'Disabled'}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Upload className="h-3 w-3" />
                Max Upload
              </p>
              <p className="text-lg font-semibold">{formatBytes(record.limits.maxUploadBytes)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                Players / Tickets
              </p>
              <p className="text-lg font-semibold">
                {record.usage.userCount.toLocaleString()} / {record.usage.ticketCount.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            Recent Admin Activity
          </CardTitle>
          <CardDescription>Beta lifecycle actions for this panel</CardDescription>
        </CardHeader>
        <CardContent>
          {auditEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No recorded admin activity yet.
            </p>
          ) : (
            <div>
              {auditEntries.map((entry, index) => (
                <AuditRow key={`${entry.action}-${entry.timestamp ?? index}`} entry={entry} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
