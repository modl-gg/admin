import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@modl-gg/shared-web/components/ui/card';
import { Badge } from '@modl-gg/shared-web/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/utils';
import { Globe, Shield } from 'lucide-react';

export default function SecurityPage() {
  const { session } = useAuth();
  const loggedInIps = session?.loggedInIps ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center space-x-3">
        <Shield className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold">Security</h1>
          <p className="text-sm text-muted-foreground">Your admin session and its active IP addresses</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Session</CardTitle>
          <CardDescription>Details of your authenticated admin session</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{session?.email ?? 'Unknown'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last activity</span>
            <span className="font-medium">{session?.lastActivityAt ? formatDate(session.lastActivityAt) : 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Active session IPs</span>
            <Badge variant="outline">{loggedInIps.length}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logged-in IP Addresses</CardTitle>
          <CardDescription>IP addresses currently holding an active session for this admin account</CardDescription>
        </CardHeader>
        <CardContent>
          {loggedInIps.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No session IP addresses recorded.</p>
          ) : (
            <ul className="space-y-2">
              {loggedInIps.map((ip) => (
                <li key={ip} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm">{ip}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
