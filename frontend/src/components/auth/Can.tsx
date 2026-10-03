import React from 'react';
import { Permission } from '../../types/auth';
import { useAuthStore } from '../../stores/authStore';
import { hasPermission } from '../../lib/permissions';

interface CanProps {
  do: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({ do: permission, children, fallback = null }) => {
  const user = useAuthStore((state) => state.user);

  if (!user || !hasPermission(user.role, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
