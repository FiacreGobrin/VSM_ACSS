import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { UserRole, Permission } from '../../types/auth';
import { hasPermission, ROLE_DISPLAY_NAMES } from '../../lib/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: Permission;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requiredPermission,
}) => {
  const location = useLocation();
  const { isAuthenticated, user, switchRole } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const roleAllowed = !allowedRoles || allowedRoles.includes(user.role);
  const permAllowed = !requiredPermission || hasPermission(user.role, requiredPermission);

  if (!roleAllowed || !permAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-full mb-6 text-rose-500 shadow-glow-destructive">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold font-mono tracking-tight text-rose-400 mb-2">
          AIR-GAP ACCESS RESTRICTION: 403 FORBIDDEN
        </h2>
        <p className="text-muted-foreground max-w-md mb-6 text-sm">
          Your active clearance level (<span className="text-foreground font-semibold">{ROLE_DISPLAY_NAMES[user.role]}</span>)
          does not possess sufficient privileges to execute operations on this console route.
        </p>

        <div className="p-4 bg-card border border-border rounded-lg max-w-lg w-full text-left font-mono text-xs mb-6 space-y-1">
          <div className="text-muted-foreground">Operator: <span className="text-foreground">{user.fullName}</span></div>
          <div className="text-muted-foreground">Clearance: <span className="text-amber-400">{user.clearanceLevel}</span></div>
          <div className="text-muted-foreground">Required Clearance: <span className="text-cyan-400">{allowedRoles ? allowedRoles.join(', ') : requiredPermission}</span></div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-md transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Authorized Route
          </button>
          
          <button
            onClick={() => switchRole('super_admin')}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-md transition-all shadow-glow-primary"
          >
            Elevate to Super Admin (Demo Mode)
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
