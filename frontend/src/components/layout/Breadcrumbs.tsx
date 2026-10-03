import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const ROUTE_LABELS: Record<string, string> = {
  console: 'Security Console',
  cameras: 'Camera Wall (500 Channels)',
  floorplan: 'Tactical Floor Plan',
  alerts: 'Live Alerts Feed',
  watchlists: 'Watchlists & Blacklists',
  visitors: 'Visitor Management',
  'pre-register': 'Pre-Registration',
  'roll-call': 'Emergency Roll-Call',
  kiosk: 'Self-Service Kiosk',
  gate: 'Gate & ANPR Terminal',
  access: 'Access Control',
  doors: 'Door Controllers & Turnstiles',
  elevators: 'Otis Compass Elevators',
  health: 'Infrastructure & System Health',
  compliance: 'Compliance & Audit Standards',
  portal: 'Client Tenant Portal',
  admin: 'System Administration',
};

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  if (pathSegments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono py-2 select-none">
      <Link
        to="/console"
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">SOC HQ</span>
      </Link>

      {pathSegments.map((segment, index) => {
        const path = `/${pathSegments.slice(0, index + 1).join('/')}`;
        const isLast = index === pathSegments.length - 1;
        const label = ROUTE_LABELS[segment] || segment.toUpperCase();

        return (
          <React.Fragment key={path}>
            <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
            {isLast ? (
              <span className="text-foreground font-semibold truncate">{label}</span>
            ) : (
              <Link
                to={path}
                className="text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
