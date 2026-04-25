'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Map,
  Calendar,
  FileText,
  BarChart3,
  Settings,
  PhoneIncoming,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

import { api } from '@/lib/trpc/client';

type Role = 'admin' | 'dispatcher' | 'tech' | 'customer';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  // Roles that can see this item; if undefined → visible to all authenticated users.
  roles?: Role[];
};

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'dispatcher'] },
  { label: 'Leads',     href: '/leads',     icon: PhoneIncoming,    roles: ['admin', 'dispatcher'] },
  { label: 'Customers', href: '/customers', icon: Users,            roles: ['admin', 'dispatcher'] },
  { label: 'Jobs',      href: '/jobs',      icon: Briefcase /* visible to tech too — they only see assigned */ },
  { label: 'Dispatch',  href: '/dispatch',  icon: Map,              roles: ['admin', 'dispatcher'] },
  { label: 'Schedule',  href: '/schedule',  icon: Calendar,         roles: ['admin', 'dispatcher'] },
  { label: 'Invoices',  href: '/invoices',  icon: FileText,         roles: ['admin', 'dispatcher'] },
  { label: 'Reports',   href: '/reports',   icon: BarChart3,        roles: ['admin'] },
  { label: 'Settings',  href: '/settings',  icon: Settings,         roles: ['admin'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Pull current user's role to filter nav items.
  // staleTime=Infinity — role doesn't change mid-session; one fetch per page load
  const { data: me } = api.auth.me.useQuery(undefined, { staleTime: Infinity });
  const role = (me?.role ?? 'admin') as Role; // default 'admin' during loading prevents nav flicker for admin users

  const visibleNavItems = navItems.filter((it) => !it.roles || it.roles.includes(role));

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile burger — visible only <md */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-30 inline-flex h-11 w-11 items-center justify-center rounded-md bg-[hsl(var(--sidebar))] text-white shadow-md"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'sidebar-dark flex h-screen flex-col transition-all duration-300',
          // Desktop: in-flow with collapse width
          'hidden md:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <SidebarInner
          pathname={pathname}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          items={visibleNavItems}
          role={role}
          userName={me?.fullName}
        />
      </aside>

      {/* Mobile drawer (full-width slide from left) */}
      <aside
        className={cn(
          'sidebar-dark md:hidden fixed top-0 left-0 z-50 h-screen w-72 flex flex-col transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-md text-white/70 hover:bg-white/10"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarInner pathname={pathname} collapsed={false} onToggle={() => {}} hideToggle items={visibleNavItems} role={role} userName={me?.fullName} />
      </aside>
    </>
  );
}

function SidebarInner({
  pathname,
  collapsed,
  onToggle,
  hideToggle,
  items,
  role,
  userName,
}: {
  pathname: string;
  collapsed: boolean;
  onToggle: () => void;
  hideToggle?: boolean;
  items: NavItem[];
  role: Role;
  userName?: string;
}) {
  return (
    <>
      {/* Logo + role badge */}
      <div className="flex h-20 items-center px-6 border-b border-white/5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--primary))] font-black text-white text-sm">
          GH
        </div>
        {!collapsed && (
          <div className="ml-3 overflow-hidden flex-1 min-w-0">
            <p className="text-[15px] font-semibold leading-tight tracking-tight">Gold Hands</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn(
                'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                role === 'admin' && 'bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]',
                role === 'dispatcher' && 'bg-blue-500/20 text-blue-300',
                role === 'tech' && 'bg-amber-500/20 text-amber-300',
                role === 'customer' && 'bg-white/10 text-white/60',
              )}>
                {role}
              </span>
              {userName && (
                <p className="text-[10px] text-white/50 truncate">{userName.split(' ')[0]}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {items.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'sidebar-link flex items-center gap-3 rounded-md px-3 py-3 text-[14px] transition-colors',
                isActive && 'active',
                collapsed && 'justify-center px-2',
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.badge != null && item.badge > 0 && (
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[10px] font-bold text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {!hideToggle && (
        <div className="border-t border-white/5 p-3">
          <button
            onClick={onToggle}
            className={cn(
              'flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-white/60 hover:text-white hover:bg-white/5 transition-colors',
              collapsed && 'justify-center px-2',
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
