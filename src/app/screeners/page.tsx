import { Suspense } from 'react';
import { ScreenerHub } from '@/components/screeners/ScreenerHub';

export default function ScreenersPage() {
  return (
    <Suspense fallback={<ScreenerLoadingSkeleton />}>
      <ScreenerHub />
    </Suspense>
  );
}

function ScreenerLoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <div className="h-7 bg-border rounded w-48 mb-2" />
        <div className="h-4 bg-border rounded w-80" />
      </div>
      <div className="flex gap-2.5 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 w-36 bg-border rounded-xl animate-pulse shrink-0" />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-4 animate-pulse">
            <div className="h-3 bg-border rounded w-24 mb-3" />
            <div className="h-6 bg-border rounded w-16 mb-2" />
            <div className="h-3 bg-border rounded w-32" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-28 bg-border rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="glass-card p-4 animate-pulse">
        <div className="h-8 bg-border rounded mb-3" />
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-border rounded" />
          ))}
        </div>
      </div>
      <div className="glass-card p-8 animate-pulse">
        <div className="h-64 bg-border rounded" />
      </div>
    </div>
  );
}
