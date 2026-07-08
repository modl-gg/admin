import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Badge } from '@modl-gg/shared-web/components/ui/badge';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@modl-gg/shared-web/components/ui/card';
import { Textarea } from '@modl-gg/shared-web/components/ui/textarea';
import { Input } from '@modl-gg/shared-web/components/ui/input';
import { useToast } from '@modl-gg/shared-web/hooks/use-toast';
import { AlertTriangle, Bell, Edit, RefreshCw, Save, X } from 'lucide-react';
import {
  alertsService,
  type AlertPayload,
  type SystemAlert,
  type SystemAlertAudience,
  type SystemAlertSeverity,
} from '@/lib/services/alerts-service';
import { useSingleFlight } from '@/hooks/useSingleFlight';

const severityLabels: Record<SystemAlertSeverity, string> = {
  BASIC: 'Basic',
  WARNING: 'Warning',
  CRITICAL: 'Critical',
};

const audienceLabels: Record<SystemAlertAudience, string> = {
  ALL_PANEL_USERS: 'All panel users',
  SUPER_ADMINS_ONLY: 'Super admins only',
};

interface AlertFormState {
  message: string;
  severity: SystemAlertSeverity;
  audience: SystemAlertAudience;
  expiresAt: string;
}

function toDatetimeLocal(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function defaultFormState(): AlertFormState {
  return {
    message: '',
    severity: 'BASIC',
    audience: 'ALL_PANEL_USERS',
    expiresAt: toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
  };
}

function toFormState(alert: SystemAlert): AlertFormState {
  return {
    message: alert.message,
    severity: alert.severity,
    audience: alert.audience,
    expiresAt: alert.expiresAt ? toDatetimeLocal(new Date(alert.expiresAt)) : defaultFormState().expiresAt,
  };
}

function toPayload(form: AlertFormState): AlertPayload {
  return {
    message: form.message.trim(),
    severity: form.severity,
    audience: form.audience,
    expiresAt: new Date(form.expiresAt).toISOString(),
  };
}

function formatDate(value?: string): string {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [form, setForm] = useState<AlertFormState>(defaultFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [minimumExpiresAt, setMinimumExpiresAt] = useState(() => toDatetimeLocal(new Date()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const loadSequence = useRef(0);
  const { toast } = useToast();

  const editingAlert = useMemo(
    () => alerts.find((alert) => alert.id === editingId) ?? null,
    [alerts, editingId]
  );

  useEffect(() => {
    loadAlerts();
  }, []);

  useEffect(() => {
    const updateMinimumExpiresAt = () => setMinimumExpiresAt(toDatetimeLocal(new Date()));
    const interval = window.setInterval(updateMinimumExpiresAt, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!editingId) {
      return;
    }

    if (!alerts.some((alert) => alert.id === editingId)) {
      resetForm();
    }
  }, [alerts, editingId]);

  const loadAlerts = async () => {
    const requestId = loadSequence.current + 1;
    loadSequence.current = requestId;

    try {
      setLoading(true);
      const loadedAlerts = await alertsService.getAlerts();
      if (loadSequence.current === requestId) {
        setAlerts(loadedAlerts);
      }
    } catch (caught) {
      if (loadSequence.current !== requestId) {
        return;
      }
      console.error('Error loading alerts:', caught);
      toast({
        title: 'Error',
        description: 'Failed to load alerts',
        variant: 'destructive',
      });
    } finally {
      if (loadSequence.current === requestId) {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(defaultFormState());
  };

  const startEditing = (alert: SystemAlert) => {
    setEditingId(alert.id);
    setForm(toFormState(alert));
  };

  const submitAlert = useSingleFlight(async () => {
    const expiresAtMs = new Date(form.expiresAt).getTime();
    const now = Date.now();
    setMinimumExpiresAt(toDatetimeLocal(new Date(now)));

    if (!form.message.trim()) {
      toast({
        title: 'Error',
        description: 'Alert message is required',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
      toast({
        title: 'Error',
        description: 'Expiry must be in the future',
        variant: 'destructive',
      });
      return;
    }

    if (editingId && !editingAlert) {
      resetForm();
      toast({
        title: 'Error',
        description: 'The alert being edited is no longer available',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await alertsService.updateAlert(editingId, toPayload(form));
      } else {
        await alertsService.createAlert(toPayload(form));
      }
      toast({
        title: 'Success',
        description: editingId ? 'Alert updated' : 'Alert created',
      });
      resetForm();
      await loadAlerts();
    } catch (caught) {
      console.error('Error saving alert:', caught);
      toast({
        title: 'Error',
        description: 'Failed to save alert',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitAlert();
  };

  const isExpired = (alert: SystemAlert) => alert.expiresAt ? new Date(alert.expiresAt).getTime() <= Date.now() : true;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Panel Alerts</h1>
            <p className="text-muted-foreground mt-1">Create dashboard notices for server panel users.</p>
          </div>
          <Button variant="outline" onClick={loadAlerts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {editingAlert ? 'Edit Alert' : 'New Alert'}
              </CardTitle>
              <CardDescription>
                Alerts remain stored after expiry and stop showing automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="message">Message</label>
                  <Textarea
                    id="message"
                    value={form.message}
                    onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                    className="min-h-[140px]"
                    maxLength={500}
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="severity">Level</label>
                    <select
                      id="severity"
                      value={form.severity}
                      onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value as SystemAlertSeverity }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {Object.entries(severityLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="audience">Audience</label>
                    <select
                      id="audience"
                      value={form.audience}
                      onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value as SystemAlertAudience }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {Object.entries(audienceLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="expiresAt">Expires</label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    min={minimumExpiresAt}
                    value={form.expiresAt}
                    onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
                    required
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    {editingAlert ? 'Save Changes' : 'Create Alert'}
                  </Button>
                  {editingAlert && (
                    <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alert History</CardTitle>
              <CardDescription>Expired alerts stay listed here for audit context.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  Loading alerts...
                </div>
              ) : alerts.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                  No alerts have been created.
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="rounded-lg border bg-card p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={alert.severity === 'CRITICAL' ? 'destructive' : 'secondary'}>
                              {severityLabels[alert.severity]}
                            </Badge>
                            <Badge variant="outline">{audienceLabels[alert.audience]}</Badge>
                            {isExpired(alert) && <Badge variant="outline">Expired</Badge>}
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{alert.message}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Expires: {formatDate(alert.expiresAt)}</span>
                            <span>Updated: {formatDate(alert.updatedAt)}</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => startEditing(alert)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>Panel visibility is determined by the expiry date and audience. Editing an expired alert to a future expiry makes it visible again.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
