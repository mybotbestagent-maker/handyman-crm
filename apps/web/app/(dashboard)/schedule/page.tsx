'use client';

import { Topbar } from '@/components/layout/topbar';
import { api } from '@/lib/trpc/client';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

const HOUR_START = 7;
const HOUR_END = 20;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

const TECH_COLORS = [
  'bg-orange-500/90 border-orange-600 text-white',
  'bg-blue-500/90 border-blue-600 text-white',
  'bg-green-500/90 border-green-600 text-white',
  'bg-purple-500/90 border-purple-600 text-white',
  'bg-pink-500/90 border-pink-600 text-white',
  'bg-cyan-500/90 border-cyan-600 text-white',
];

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay() === 0 ? 7 : x.getDay();
  x.setDate(x.getDate() - day + 1);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function fmtRange(start: Date, end: Date) {
  const sameMonth = start.getMonth() === end.getMonth();
  const a = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const b = end.toLocaleDateString('en-US', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `${a} – ${b}, ${start.getFullYear()}`;
}

export default function SchedulePage() {
  // Default week: May 4-10 2026 (where seed data lives)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date('2026-05-04')));
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const [selectedTech, setSelectedTech] = useState<string | null>(null);

  const { data: jobsData } = api.job.list.useQuery({
    from: weekStart,
    to: addDays(weekStart, 7),
    limit: 100,
  });
  const { data: techs = [] } = api.technician.list.useQuery({ isActive: true });
  const jobs = jobsData?.items ?? [];

  const techColorMap = useMemo(() => {
    const map = new Map<string, string>();
    techs.forEach((t: any, i: number) => map.set(t.id, TECH_COLORS[i % TECH_COLORS.length]));
    return map;
  }, [techs]);

  const filteredJobs = selectedTech
    ? jobs.filter((j: any) => j.assignedTechnicianId === selectedTech)
    : jobs;

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  function jobsForCell(day: Date, hour: number) {
    return filteredJobs.filter((j: any) => {
      if (!j.scheduledStart) return false;
      const s = new Date(j.scheduledStart);
      return (
        s.getFullYear() === day.getFullYear() &&
        s.getMonth() === day.getMonth() &&
        s.getDate() === day.getDate() &&
        s.getHours() === hour
      );
    });
  }

  function jobBlockHeight(j: any) {
    if (!j.scheduledStart || !j.scheduledEnd) return 56;
    const s = new Date(j.scheduledStart);
    const e = new Date(j.scheduledEnd);
    const minutes = Math.max((e.getTime() - s.getTime()) / 60000, 30);
    return (minutes / 60) * 56;
  }

  function handleCellClick(day: Date, hour: number) {
    const dt = new Date(day);
    dt.setHours(hour, 0, 0, 0);
    const techName = selectedTech
      ? (techs.find((t: any) => t.id === selectedTech) as any)?.user?.fullName
      : 'unassigned';
    alert(
      `Create Job\n\nWhen: ${dt.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}\nTech: ${techName}\n\n(Job-create modal — coming next iteration)`,
    );
  }

  return (
    <>
      <Topbar title="Schedule" />

      <div className="px-4 md:px-10 py-8 md:py-10 max-w-[1600px] mx-auto space-y-6 mt-12 md:mt-0">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Week View · Click a cell
            </p>
            <h1 className="hero-headline !text-[34px] md:!text-[52px]">{fmtRange(weekStart, weekEnd)}</h1>
            <p className="mt-3 text-[14px] text-muted-foreground">
              {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} this week
              {selectedTech && techs.find((t: any) => t.id === selectedTech)
                ? ` · ${(techs.find((t: any) => t.id === selectedTech) as any).user?.fullName}`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="h-11 w-11 inline-flex items-center justify-center rounded-md border border-border hover:bg-secondary"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="h-11 px-4 rounded-md border border-border hover:bg-secondary text-[13px] font-medium"
            >
              Today
            </button>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="h-11 w-11 inline-flex items-center justify-center rounded-md border border-border hover:bg-secondary"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedTech(null)}
            className={`h-9 px-4 rounded-full text-[13px] font-medium border transition-colors ${
              !selectedTech
                ? 'bg-foreground text-background border-foreground'
                : 'border-border hover:bg-secondary'
            }`}
          >
            All techs
          </button>
          {techs.map((t: any) => (
            <button
              key={t.id}
              onClick={() => setSelectedTech(t.id)}
              className={`h-9 px-4 rounded-full text-[13px] font-medium border transition-colors flex items-center gap-2 ${
                selectedTech === t.id
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border hover:bg-secondary'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${(techColorMap.get(t.id) ?? '').split(' ')[0]}`} />
              {t.user?.fullName}
            </button>
          ))}
        </div>

        <div className="card-premium overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-secondary/50 sticky top-0 z-10">
              <div className="p-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" />
              {days.map((d, i) => {
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={i}
                    className={`p-3 text-center border-l border-border ${
                      isToday ? 'bg-[hsl(var(--primary))]/5' : ''
                    }`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {fmtDay(d)}
                    </p>
                    <p
                      className={`mt-1 text-[18px] font-bold tracking-tight ${
                        isToday ? 'text-[hsl(var(--primary))]' : ''
                      }`}
                    >
                      {d.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            {HOURS.map((h) => (
              <div
                key={h}
                className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border last:border-b-0"
                style={{ minHeight: 56 }}
              >
                <div className="p-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border">
                  {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                </div>
                {days.map((d, di) => {
                  const cellJobs = jobsForCell(d, h);
                  return (
                    <div
                      key={di}
                      onClick={() => cellJobs.length === 0 && handleCellClick(d, h)}
                      className={`relative border-l border-border p-1 ${
                        cellJobs.length === 0
                          ? 'hover:bg-[hsl(var(--primary))]/5 cursor-pointer group'
                          : ''
                      }`}
                    >
                      {cellJobs.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <Plus className="h-4 w-4 text-[hsl(var(--primary))]" />
                        </div>
                      )}
                      {cellJobs.map((j: any) => {
                        const colorClass =
                          techColorMap.get(j.assignedTechnicianId) ?? 'bg-gray-400 border-gray-500 text-white';
                        return (
                          <div
                            key={j.id}
                            className={`rounded border-l-4 px-2 py-1 text-[11px] leading-tight overflow-hidden ${colorClass}`}
                            style={{ height: jobBlockHeight(j) - 8 }}
                            title={`${j.jobNumber} — ${j.description}`}
                          >
                            <p className="font-semibold truncate">{j.jobNumber}</p>
                            <p className="truncate opacity-90">{j.customer?.billingName}</p>
                            <p className="truncate text-[10px] opacity-75">{j.category}</p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[12px] text-muted-foreground">
          ⚡ Click an empty cell to create a job · drag&drop coming next iteration
        </p>
      </div>
    </>
  );
}
