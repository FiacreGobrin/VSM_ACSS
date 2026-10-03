import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  Video,
  MapPin,
  BellRing,
  UserCheck,
  UserPlus,
  Car,
  DoorClosed,
  ArrowUpDown,
  Server,
  FileCheck2,
  Building2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Tablet,
  ListFilter,
  Flame,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { hasPermission } from '../../lib/permissions';

interface NavGroup {
  title: string;
  items: {
    label: string;
    path: string;
    icon: React.ElementType;
    permission?: any;
    badge?: string;
    badgeVariant?: 'critical' | 'primary' | 'muted';
    external?: boolean;
  }[];
}

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navGroups: NavGroup[] = [
    {
      title: 'Security Operations',
      items: [
        {
          label: t('nav.securityConsole'),
          path: '/console',
          icon: Shield,
          permission: 'alerts:view',
        },
        {
          label: t('nav.cameraWall'),
          path: '/console/cameras',
          icon: Video,
          permission: 'cameras:view',
          badge: '500 CH',
          badgeVariant: 'muted',
        },
        {
          label: t('nav.floorPlan'),
          path: '/console/floorplan',
          icon: MapPin,
          permission: 'cameras:view',
        },
        {
          label: t('nav.alerts'),
          path: '/console/alerts',
          icon: BellRing,
          permission: 'alerts:view',
          badge: '3 LIVE',
          badgeVariant: 'critical',
        },
        {
          label: t('nav.watchlists'),
          path: '/console/watchlists',
          icon: ListFilter,
          permission: 'alerts:view',
        },
      ],
    },
    {
      title: 'Visitor Management',
      items: [
        {
          label: t('nav.visitorDesk'),
          path: '/visitors',
          icon: UserCheck,
          permission: 'visitors:view',
          badge: '42 On-Site',
          badgeVariant: 'primary',
        },
        {
          label: t('nav.preRegistration'),
          path: '/visitors/pre-register',
          icon: UserPlus,
          permission: 'visitors:register',
        },
        {
          label: 'Emergency Roll-Call',
          path: '/visitors/roll-call',
          icon: Flame,
          permission: 'visitors:view',
        },
        {
          label: t('nav.kiosk'),
          path: '/kiosk',
          icon: Tablet,
          permission: 'visitors:view',
        },
      ],
    },
    {
      title: 'Access & Dispatch',
      items: [
        {
          label: t('nav.gateAnpr'),
          path: '/gate',
          icon: Car,
          permission: 'anpr:view',
        },
        {
          label: t('nav.accessControl'),
          path: '/access/doors',
          icon: DoorClosed,
          permission: 'doors:view',
          badge: '100 Doors',
          badgeVariant: 'muted',
        },
        {
          label: t('nav.elevatorDispatch'),
          path: '/access/elevators',
          icon: ArrowUpDown,
          permission: 'elevators:view',
        },
      ],
    },
    {
      title: 'System & Governance',
      items: [
        {
          label: t('nav.systemHealth'),
          path: '/health',
          icon: Server,
          permission: 'system:health_view',
        },
        {
          label: t('nav.compliance'),
          path: '/compliance',
          icon: FileCheck2,
          permission: 'compliance:view',
        },
        {
          label: t('nav.clientPortal'),
          path: '/portal',
          icon: Building2,
        },
        {
          label: t('nav.admin'),
          path: '/admin',
          icon: Settings,
          permission: 'admin:settings',
        },
      ],
    },
  ];

  return (
    <aside
      className={`relative z-30 flex flex-col h-[calc(100vh-3.5rem)] bg-card border-r border-border transition-all duration-200 select-none ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navGroups.map((group, idx) => {
          // Filter items based on user role permissions
          const visibleItems = group.items.filter(
            (item) => !item.permission || hasPermission(user?.role, item.permission)
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground/80 mb-1">
                  {group.title}
                </div>
              )}

              {visibleItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-primary/15 text-primary border border-primary/30 font-semibold shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70'
                      } ${isCollapsed ? 'justify-center px-0' : ''}`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!isCollapsed && (
                      <div className="flex-1 flex items-center justify-between truncate">
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className={`ml-2 px-1.5 py-0.2 rounded text-[10px] font-mono uppercase ${
                              item.badgeVariant === 'critical'
                                ? 'bg-rose-950/80 text-rose-300 border border-rose-800 animate-pulse'
                                : item.badgeVariant === 'primary'
                                ? 'bg-primary/20 text-primary border border-primary/30'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Collapse / Expand Toggle Footer */}
      <div className="p-2 border-t border-border flex items-center justify-between">
        {!isCollapsed && (
          <div className="px-2 font-mono text-[10px] text-muted-foreground">
            AIR-GAP BUILD 2.4.0
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors ${
            isCollapsed ? 'mx-auto' : ''
          }`}
          title={isCollapsed ? 'Expand Navigation Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
