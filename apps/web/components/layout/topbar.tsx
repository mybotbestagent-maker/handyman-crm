'use client';

import { Bell, Search, Plus } from 'lucide-react';
import Link from 'next/link';

type TopbarProps = {
  title?: string;
};

export function Topbar({ title }: TopbarProps) {
  return (
    <header className="flex h-16 items-center gap-3 border-b border-border bg-card px-4 md:px-8">
      {/* Title — hidden on mobile (we have hero header in page) */}
      {title && (
        <h1 className="hidden md:block ml-12 md:ml-0 text-[14px] font-medium tracking-tight text-muted-foreground">
          {title}
        </h1>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Search — hidden on small screens */}
        <div className="relative hidden lg:flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground/60" />
          <input
            type="search"
            placeholder="Search customers, jobs..."
            className="h-10 w-72 rounded-full border border-border bg-secondary/50 pl-10 pr-4 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))/30] focus:border-[hsl(var(--primary))]"
          />
        </div>

        {/* Search icon button on small screens */}
        <button className="lg:hidden h-11 w-11 inline-flex items-center justify-center rounded-md hover:bg-secondary transition-colors" aria-label="Search">
          <Search className="h-5 w-5 text-foreground" />
        </button>

        {/* Quick add */}
        <Link
          href="/jobs"
          className="btn-orange inline-flex items-center gap-2 text-[13px] !py-2.5"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Job</span>
        </Link>

        {/* Notifications */}
        <button className="relative h-11 w-11 inline-flex items-center justify-center rounded-md border border-border hover:bg-secondary transition-colors" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />
        </button>

        {/* User avatar */}
        <button className="h-11 w-11 inline-flex items-center justify-center rounded-full bg-foreground text-sm font-bold text-background" aria-label="User menu">
          F
        </button>
      </div>
    </header>
  );
}
