import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Server, Activity, BarChart3, Sparkles, LogOut } from 'lucide-react';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import Logo from '@/components/Logo';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/servers', label: 'Servers', icon: Server },
  { href: '/monitoring', label: 'Monitoring', icon: Activity },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/prompts', label: 'AI Prompts', icon: Sparkles },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { session, logout } = useAuth();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return location === href;
    return location.startsWith(href);
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <Logo />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon, exact }) => (
            <Link key={href} href={href}>
              <a className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive(href, exact)
                  ? 'bg-primary/10 text-primary border-l-2 border-primary pl-[10px]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </a>
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t space-y-1">
          {session?.email && (
            <div className="px-3 py-1 text-xs text-muted-foreground truncate">
              {session.email}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
