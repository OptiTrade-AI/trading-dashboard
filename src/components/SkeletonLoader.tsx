'use client';

import { cn } from '@/lib/utils';

function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-zinc-800/60', className)} style={style} />
  );
}

export function SkeletonStatCards({ count = 5 }: { count?: number }) {
  return (
    <div className={cn('grid gap-4', `grid-cols-1 md:grid-cols-2 lg:grid-cols-${count}`)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-5 space-y-3">
          <Bone className="h-3 w-20" />
          <Bone className="h-8 w-28" />
          <Bone className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3">
        {[80, 60, 50, 70, 60, 80].map((w, i) => (
          <Bone key={i} className="h-3" style={{ width: w }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 border-t border-border/20">
          <Bone className="h-4 w-16" />
          <Bone className="h-4 w-14" />
          <Bone className="h-4 w-10" />
          <Bone className="h-4 w-20" />
          <Bone className="h-4 w-20" />
          <Bone className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="glass-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1 space-y-2">
            <Bone className="h-3 w-24" />
            <Bone className="h-9 w-36" />
          </div>
          <div className="hidden lg:block w-px h-16 bg-border/30" />
          <div className="flex-1 space-y-2">
            <Bone className="h-3 w-16" />
            <Bone className="h-9 w-32" />
            <Bone className="h-3 w-24" />
          </div>
          <div className="hidden lg:block w-px h-16 bg-border/30" />
          <div className="flex items-center gap-4">
            <Bone className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Bone className="h-3 w-16" />
              <Bone className="h-3 w-10" />
            </div>
          </div>
          <div className="hidden lg:block w-px h-16 bg-border/30" />
          <div className="lg:w-48 space-y-2">
            <Bone className="h-3 w-full" />
            <Bone className="h-2.5 w-full rounded-full" />
          </div>
        </div>
      </div>

      {/* Strategy pulse */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-4 flex items-center gap-4">
            <Bone className="w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <Bone className="h-3.5 w-20" />
                <Bone className="h-3.5 w-16" />
              </div>
              <Bone className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Open positions */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex justify-between">
          <Bone className="h-5 w-40" />
          <Bone className="h-4 w-16" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/20">
            <Bone className="w-1 h-10 rounded-full" />
            <Bone className="h-4 w-20" />
            <Bone className="h-4 w-32 flex-1" />
            <Bone className="h-4 w-16" />
            <Bone className="h-6 w-12 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass-card p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-loss/10 flex items-center justify-center mx-auto mb-4">
        <span className="text-loss text-2xl font-bold">!</span>
      </div>
      <h3 className="text-foreground font-medium mb-2">Something went wrong</h3>
      <p className="text-muted text-sm mb-4">{message}</p>
      <button onClick={onRetry} className="btn-primary">
        Try Again
      </button>
    </div>
  );
}
