'use client';

import { useState } from 'react';
import { useHoldings } from '@/hooks/useHoldings';
import { HoldingsTable } from '@/components/HoldingsTable';
import { HoldingsModal } from '@/components/HoldingsModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { StatCard } from '@/components/StatCard';
import { SkeletonStatCards, SkeletonTable, ErrorState } from '@/components/SkeletonLoader';
import { StockHolding } from '@/types';
import { useFormatters } from '@/hooks/useFormatters';

export default function HoldingsPage() {
  const { formatCurrency, mask } = useFormatters();
  const {
    holdings, totalShares, totalCostBasis, uniqueTickers, avgCostPerShare,
    addHolding, updateHolding, deleteHolding, isLoading, error, retry,
  } = useHoldings();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editModalHolding, setEditModalHolding] = useState<StockHolding | null>(null);
  const [deleteModalHolding, setDeleteModalHolding] = useState<StockHolding | null>(null);

  const confirmDelete = () => {
    if (deleteModalHolding) {
      deleteHolding(deleteModalHolding.id);
      setDeleteModalHolding(null);
    }
  };

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Stock Holdings</h1>
          <p className="text-muted mt-1">Track your share positions</p>
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
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Stock Holdings</h1>
          <p className="text-muted mt-1">Track your share positions</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          + Add Holding
        </button>
      </div>

      {/* Stats */}
      {isLoading ? (
        <SkeletonStatCards count={4} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Tickers"
            value={uniqueTickers.toString()}
            subValue={`${holdings.length} lots`}
          />
          <StatCard
            label="Total Shares"
            value={mask(totalShares.toLocaleString())}
            subValue="Across all positions"
          />
          <StatCard
            label="Total Cost Basis"
            value={formatCurrency(totalCostBasis)}
            variant="accent"
            subValue="All holdings"
          />
          <StatCard
            label="Avg Cost/Share"
            value={totalShares > 0 ? formatCurrency(avgCostPerShare) : '-'}
            subValue="Weighted average"
          />
        </div>
      )}

      {/* Table */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">All Holdings</h2>
          <span className="text-muted text-sm">{holdings.length} total</span>
        </div>
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : (
          <HoldingsTable
            holdings={holdings}
            onEdit={(holding) => setEditModalHolding(holding)}
            onDelete={(holding) => setDeleteModalHolding(holding)}
          />
        )}
      </div>

      {/* Modals */}
      <HoldingsModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={addHolding}
      />
      <HoldingsModal
        isOpen={!!editModalHolding}
        onClose={() => setEditModalHolding(null)}
        onSubmit={addHolding}
        editHolding={editModalHolding}
        onUpdate={updateHolding}
      />
      <ConfirmModal
        isOpen={!!deleteModalHolding}
        title="Delete Holding"
        message={deleteModalHolding ? `Delete ${deleteModalHolding.ticker} ${deleteModalHolding.shares} shares?` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModalHolding(null)}
      />
    </div>
  );
}
