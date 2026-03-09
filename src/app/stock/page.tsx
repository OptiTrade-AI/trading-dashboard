'use client';

import { useState } from 'react';
import { useStockEvents } from '@/hooks/useStockEvents';
import { StockEventTable } from '@/components/StockEventTable';
import { AddStockEventModal } from '@/components/StockEventModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { StatCard } from '@/components/StatCard';
import { SkeletonStatCards, SkeletonTable, ErrorState } from '@/components/SkeletonLoader';
import { StockEvent } from '@/types';
import { formatCurrency, exportStockEventsToCSV } from '@/lib/utils';

export default function StockEventsPage() {
  const { stockEvents, totalStockPL, tlhEvents, totalHarvestedLosses, addStockEvent, deleteStockEvent, isLoading, error, retry } = useStockEvents();
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteModalEvent, setDeleteModalEvent] = useState<StockEvent | null>(null);

  const confirmDelete = () => {
    if (deleteModalEvent) {
      deleteStockEvent(deleteModalEvent.id);
      setDeleteModalEvent(null);
    }
  };

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Stock Events</h1>
          <p className="text-muted mt-1">Track stock sales and tax loss harvesting</p>
        </div>
        <ErrorState message={error} onRetry={retry} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Stock Events</h1>
          <p className="text-muted mt-1">Track stock sales and tax loss harvesting</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportStockEventsToCSV(stockEvents)}
            className="btn-secondary"
            disabled={stockEvents.length === 0}
          >
            Export CSV
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            + Log Sale
          </button>
        </div>
      </div>

      {/* Stats */}
      {isLoading ? (
        <SkeletonStatCards count={4} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Stock P/L"
            value={formatCurrency(totalStockPL)}
            variant={totalStockPL >= 0 ? 'profit' : 'loss'}
            subValue={`${stockEvents.length} events`}
          />
          <StatCard
            label="TLH Events"
            value={tlhEvents.length.toString()}
            subValue="Tax loss harvests"
          />
          <StatCard
            label="Losses Harvested"
            value={formatCurrency(Math.abs(totalHarvestedLosses))}
            variant="accent"
            subValue="Tax benefit"
          />
          <StatCard
            label="Non-TLH P/L"
            value={formatCurrency(totalStockPL - totalHarvestedLosses)}
            variant={totalStockPL - totalHarvestedLosses >= 0 ? 'profit' : 'loss'}
            subValue="Regular stock sales"
          />
        </div>
      )}

      {/* Table */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">All Stock Events</h2>
          <span className="text-muted text-sm">{stockEvents.length} total</span>
        </div>
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : (
          <StockEventTable
            events={stockEvents}
            onDelete={(event) => setDeleteModalEvent(event)}
          />
        )}
      </div>

      {/* Modals */}
      <AddStockEventModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={addStockEvent}
      />
      <ConfirmModal
        isOpen={!!deleteModalEvent}
        title="Delete Stock Event"
        message={deleteModalEvent ? `Delete ${deleteModalEvent.ticker} ${deleteModalEvent.shares} shares sale?` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModalEvent(null)}
      />
    </div>
  );
}
