import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@modl-gg/shared-web/components/ui/card';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { Input } from '@modl-gg/shared-web/components/ui/input';
import { Label } from '@modl-gg/shared-web/components/ui/label';
import { Badge } from '@modl-gg/shared-web/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@modl-gg/shared-web/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@modl-gg/shared-web/components/ui/pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@modl-gg/shared-web/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@modl-gg/shared-web/components/ui/alert-dialog';
import { useToast } from '@modl-gg/shared-web/hooks/use-toast';
import {
  FlaskConical,
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  RotateCcw,
  Ban,
  Trash2,
} from 'lucide-react';
import { betaTestersService } from '@/lib/services/beta-testers-service';
import { type BetaTesterRecord } from '@/lib/api-contracts/beta-testers';
import { CreateBetaTesterModal } from '@/components/CreateBetaTesterModal';
import { formatDate } from '@/lib/utils';

type RowActionType = 'reset' | 'revoke';

interface RowAction {
  record: BetaTesterRecord;
  type: RowActionType;
}

const RESET_ALL_CONFIRM_PHRASE = 'RESET ALL';

function getStatusBadge(record: BetaTesterRecord) {
  if (!record.betaTester) {
    return <Badge variant="destructive">Revoked</Badge>;
  }

  if (!record.emailVerified) {
    return <Badge variant="warning">Unverified</Badge>;
  }

  switch (record.provisioningStatus) {
    case 'completed':
      return <Badge variant="success">Active</Badge>;
    case 'pending':
    case 'in-progress':
      return <Badge variant="info">Provisioning</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

export default function BetaTestersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [rowAction, setRowAction] = useState<RowAction | null>(null);
  const [isResetAllOpen, setIsResetAllOpen] = useState(false);
  const [resetAllConfirm, setResetAllConfirm] = useState('');

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['beta-testers', { search: searchTerm, page: currentPage, limit: pageSize }],
    queryFn: () =>
      betaTestersService.listBetaTesters({
        search: searchTerm || undefined,
        page: currentPage,
        limit: pageSize,
      }),
  });

  const betaTesters = data?.betaTesters ?? [];
  const pagination = data?.pagination ?? { total: 0, pages: 0, page: 1, limit: pageSize };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['beta-testers'] });

  const resetMutation = useMutation({
    mutationFn: (id: string) => betaTestersService.resetBetaTester(id),
    onSuccess: (result) => {
      invalidate();
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
    onSettled: () => setRowAction(null),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => betaTestersService.revokeBetaTester(id),
    onSuccess: (record) => {
      invalidate();
      toast({
        title: 'Beta access revoked',
        description: `${record.serverName} is locked out. Data is retained for auditing.`,
      });
    },
    onError: (mutationError) => {
      toast({
        title: 'Revoke failed',
        description: mutationError instanceof Error ? mutationError.message : 'Unexpected error',
        variant: 'destructive',
      });
    },
    onSettled: () => setRowAction(null),
  });

  const resetAllMutation = useMutation({
    mutationFn: () => betaTestersService.resetAllBetaTesters(),
    onSuccess: (result) => {
      invalidate();
      const succeeded = result.results.filter((entry) => entry.success).length;
      toast({
        title: 'Reset all complete',
        description: `${succeeded} of ${result.results.length} panel${
          result.results.length === 1 ? '' : 's'
        } reset successfully.`,
        variant: succeeded === result.results.length ? undefined : 'destructive',
      });
    },
    onError: (mutationError) => {
      toast({
        title: 'Reset all failed',
        description: mutationError instanceof Error ? mutationError.message : 'Unexpected error',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsResetAllOpen(false);
      setResetAllConfirm('');
    },
  });

  const isRowActionPending = resetMutation.isPending || revokeMutation.isPending;
  const isResetAction = rowAction?.type === 'reset';

  const confirmRowAction = () => {
    if (!rowAction) {
      return;
    }

    if (rowAction.type === 'reset') {
      resetMutation.mutate(rowAction.record.id);
    } else {
      revokeMutation.mutate(rowAction.record.id);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-2">
              <FlaskConical className="h-7 w-7 text-primary" />
              Beta Testing
            </h2>
            <p className="text-muted-foreground">
              Provision and manage free Premium panels for staging beta testers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex items-center gap-2 text-destructive hover:text-destructive"
              onClick={() => setIsResetAllOpen(true)}
              disabled={betaTesters.length === 0}
            >
              <Trash2 className="h-4 w-4" />
              Reset All
            </Button>
            <Button className="flex items-center gap-2" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create beta tester
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, subdomain, or email..."
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Beta Testers ({pagination.total})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Server Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Subdomain</TableHead>
                      <TableHead className="hidden md:table-cell">Admin Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(Math.min(pageSize, 8))].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="h-4 bg-muted animate-pulse rounded w-32" />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="h-4 bg-muted animate-pulse rounded w-40" />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="h-4 bg-muted animate-pulse rounded w-44" />
                        </TableCell>
                        <TableCell>
                          <div className="h-6 bg-muted animate-pulse rounded w-20" />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="h-4 bg-muted animate-pulse rounded w-24" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="h-8 w-8 bg-muted animate-pulse rounded ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-destructive">Failed to load beta testers</p>
                <p className="text-sm text-muted-foreground">{(error as Error)?.message}</p>
              </div>
            ) : betaTesters.length === 0 ? (
              <div className="text-center py-12">
                <FlaskConical className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                  No beta testers yet
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {searchTerm
                    ? 'No beta testers match your search.'
                    : 'Use "Create beta tester" to provision a free Premium panel on staging.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Server Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Subdomain</TableHead>
                        <TableHead className="hidden md:table-cell">Admin Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {betaTesters.map((record) => (
                        <TableRow key={record.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <div className="space-y-1">
                              <Link
                                href={`/beta-testers/${record.id}`}
                                className="font-medium hover:text-primary transition-colors"
                              >
                                {record.serverName}
                              </Link>
                              <div className="text-xs text-muted-foreground font-mono sm:hidden">
                                {record.customDomain}.modl.top
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className="text-sm font-mono text-muted-foreground">
                              {record.customDomain}.modl.top
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-sm">{record.adminEmail}</span>
                          </TableCell>
                          <TableCell>{getStatusBadge(record)}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {formatDate(record.betaTesterCreatedAt ?? record.createdAt ?? '')}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <Link href={`/beta-testers/${record.id}`}>
                                  <DropdownMenuItem>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </DropdownMenuItem>
                                </Link>
                                <DropdownMenuItem
                                  disabled={!record.betaTester}
                                  onSelect={() => setRowAction({ record, type: 'reset' })}
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Reset
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  disabled={!record.betaTester}
                                  onSelect={() => setRowAction({ record, type: 'revoke' })}
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Revoke
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {pagination.pages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * pageSize + 1} to{' '}
                      {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} results
                    </div>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            size="default"
                            href="#"
                            onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                              e.preventDefault();
                              if (currentPage > 1) setCurrentPage(currentPage - 1);
                            }}
                            className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                          />
                        </PaginationItem>

                        {[...Array(Math.min(pagination.pages, 7))].map((_, i) => {
                          let pageNum: number;
                          if (pagination.pages <= 7) {
                            pageNum = i + 1;
                          } else if (currentPage <= 4) {
                            pageNum = i + 1;
                          } else if (currentPage >= pagination.pages - 3) {
                            pageNum = pagination.pages - 6 + i;
                          } else {
                            pageNum = currentPage - 3 + i;
                          }

                          if (pageNum < 1 || pageNum > pagination.pages) return null;

                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                size="default"
                                href="#"
                                onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                                  e.preventDefault();
                                  setCurrentPage(pageNum);
                                }}
                                isActive={currentPage === pageNum}
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}

                        <PaginationItem>
                          <PaginationNext
                            size="default"
                            href="#"
                            onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                              e.preventDefault();
                              if (currentPage < pagination.pages) setCurrentPage(currentPage + 1);
                            }}
                            className={
                              currentPage >= pagination.pages ? 'pointer-events-none opacity-50' : ''
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateBetaTesterModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />

      <AlertDialog
        open={rowAction !== null}
        onOpenChange={(open) => {
          if (!open && !isRowActionPending) setRowAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isResetAction ? 'Reset this panel?' : 'Revoke beta access?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isResetAction ? (
                <>
                  This clears all accumulated data (players, tickets, chat logs, replays, uploads) and
                  zeroes usage counters for{' '}
                  <span className="font-medium text-foreground">{rowAction?.record.serverName}</span>.
                  Staff, roles, settings, knowledgebase, and passkeys are preserved. This cannot be
                  undone.
                </>
              ) : (
                <>
                  This locks{' '}
                  <span className="font-medium text-foreground">{rowAction?.record.serverName}</span>{' '}
                  out of their panel and downgrades them to Free. All data is retained for auditing and
                  the action is reversible by re-creating beta access.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRowActionPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmRowAction();
              }}
              disabled={isRowActionPending}
            >
              {isRowActionPending
                ? isResetAction
                  ? 'Resetting...'
                  : 'Revoking...'
                : isResetAction
                ? 'Confirm Reset'
                : 'Confirm Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isResetAllOpen}
        onOpenChange={(open) => {
          if (!open && !resetAllMutation.isPending) {
            setIsResetAllOpen(false);
            setResetAllConfirm('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset every beta panel?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears accumulated data and zeroes usage counters for{' '}
              <span className="font-medium text-foreground">all</span> beta testers. Staff, roles,
              settings, knowledgebase, and passkeys are preserved. This runs in the background and
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resetAllConfirm">
              Type{' '}
              <span className="font-mono font-semibold text-foreground">
                {RESET_ALL_CONFIRM_PHRASE}
              </span>{' '}
              to confirm
            </Label>
            <Input
              id="resetAllConfirm"
              value={resetAllConfirm}
              autoComplete="off"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setResetAllConfirm(e.target.value)
              }
              placeholder={RESET_ALL_CONFIRM_PHRASE}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetAllMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                resetAllMutation.mutate();
              }}
              disabled={
                resetAllMutation.isPending || resetAllConfirm.trim() !== RESET_ALL_CONFIRM_PHRASE
              }
            >
              {resetAllMutation.isPending ? 'Resetting all...' : 'Reset All Panels'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
