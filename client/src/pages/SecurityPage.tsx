import { Link } from 'wouter';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@modl-gg/shared-web/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowLeft,
  Shield,
  LogOut,
} from 'lucide-react';

export default function SecurityPage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link href="/">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div className="flex items-center space-x-3">
                <Shield className="h-6 w-6 text-muted-foreground" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Security</h1>
                  <p className="text-sm text-muted-foreground">Audit logs and security events</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button onClick={logout} variant="outline">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Security Events</CardTitle>
            <CardDescription>
              Monitor security-related events across the system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Security page content goes here.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 