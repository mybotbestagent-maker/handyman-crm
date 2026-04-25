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

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Leads', href: '/leads', icon: PhoneIncoming },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Jobs', href: '/jobs', icon: Briefcase },
  { label: 'Dispatch', href: '/dispatch', icon: Map },
  { label: 'Schedule', href: '/schedule', icon: Calendar },
  { label: 'Invoices', href: '/invoices', icon: FileText },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
        <SidebarInner pathname={pathname} collapsed={false} onToggle={() => {}} hideToggle />
      </aside>
    </>
  );
}

function SidebarInner({
  pathname,
  collapsed,
  onToggle,
  hideToggle,
}: {
  pathname: string;
  collapsed: boolean;
  onToggle: () => void;
  hideToggle?: boolean;
}) {
  return (
    <>
      {/* Logo */}
      <div className="flex h-20 items-center px-6 border-b border-white/5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--primary))] font-black text-white text-sm">
          GH
        </div>
        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <p className="text-[15px] font-semibold leading-tight tracking-tight">Gold Hands</p>
            <p className="text-[11px] text-white/50 mt-0.5 uppercase tracking-widest">CRM</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
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
