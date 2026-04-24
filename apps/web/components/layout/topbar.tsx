'use client';

import { Bell, Search, Plus } from 'lucide-react';
import Link from 'next/link';

type TopbarProps = {
  title?: string;
};

export function Topbar({ title }: TopbarProps) {
  return (
    <header className="flex h-16 items-center gap-4 border-b bg-card px-6">
      {/* Title — set by each page */}
      {title && <h1 className="text-lg font-semibold">{title}</h1>}

      {/* Search */}
      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden sm:flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search customers, jobs..."
            className="h-9 w-64 rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Quick add */}
        <Link
          href="/jobs"
          className="flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Job</span>
        </Link>

        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent transition-colors">
          <Bell className="h-4 w-4" />
          {/* Badge (hard-coded for now, will be dynamic) */}
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
        </button>

        {/* User avatar */}
        <button className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          F
        </button>
      </div>
    </header>
  );
}
