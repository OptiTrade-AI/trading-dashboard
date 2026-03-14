'use client';

import { useState, useMemo } from 'react';
import { useDirectionalTrades } from '@/hooks/useDirectionalTrades';
import { useTradeStats } from '@/hooks/useTradeStats';
import { DirectionalTable } from '@/components/DirectionalTable';
import { AddDirectionalModal, EditDirectionalModal, CloseDirectionalModal } from '@/components/DirectionalModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { RollHistoryModal } from '@/components/RollHistoryModal';
import { StatCard } from '@/components/StatCard';
import { SkeletonStatCards, SkeletonTable, ErrorState } from '@/components/SkeletonLoader';
import { DirectionalTrade, DirectionalExitReason } from '@/types';
import { calculateDirectionalPL, exportDirectionalToCSV } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';

export default function DirectionalPage() {
  const { formatCurrency } = useFormatters();
  const { trades, openTrades, closedTrades, addTrade, editTrade, closeTrade, deleteTrade, rollTrade, partialCloseTrade, getRollChain, isLoading, error, retry } = useDirectionalTrades();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editModalTrade, setEditModalTrade] = useState<DirectionalTrade | null>(null);
  const [closeModalTrade, setCloseModalTrade] = useState<DirectionalTrade | null>(null);
  const [deleteModalTrade, setDeleteModalTrade] = useState<DirectionalTrade | null>(null);
  const [rollChainId, setRollChainId] = useState<string | null>(null);

  const coreStats = useTradeStats(openTrades, closedTrades, calculateDirectionalPL);

  const stats = useMemo(() => {
    const capitalDeployed = openTrades.reduce((sum, t) => sum + t.costAtOpen, 0);
    return { capitalDeployed };
  }, [openTrades]);

  const handleAddTrade = (trade: Omit<DirectionalTrade, 'id' | 'dteAtEntry' | 'costAtOpen' | 'status'>) => {
    addTrade(trade);
  };

  const handleCloseTrade = (exitPrice: number, exitDate: string, exitReason: DirectionalExitReason, closeCommission?: number) => {
    if (closeModalTrade) {
      closeTrade(closeModalTrade.id, exitPrice, exitDate, exitReason, closeCommission);
      setCloseModalTrade(null);
    }
  };

  const handleRollTrade = (exitPrice: number, exitDate: string, newTrade: Omit<DirectionalTrade, 'id' | 'dteAtEntry' | 'costAtOpen' | 'status' | 'rollChainId' | 'rollNumber'>) => {
    if (closeModalTrade) {
      rollTrade(closeModalTrade.id, exitPrice, exitDate, newTrade);
      setCloseModalTrade(null);
    }
  };

  const handlePartialClose = (contractsToClose: number, exitPrice: number, exitDate: string, exitReason: DirectionalExitReason, closeCommission?: number) => {
    if (closeModalTrade) {
      partialCloseTrade(closeModalTrade.id, contractsToClose, exitPrice, exitDate, exitReason, closeCommission);
      setCloseModalTrade(null);
    }
  };

  const handleDeleteTrade = (trade: DirectionalTrade) => {
    setDeleteModalTrade(trade);
  };

  const confirmDeleteTrade = () => {
    if (deleteModalTrade) {
      deleteTrade(deleteModalTrade.id);
      setDeleteModalTrade(null);
    }
  };

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Directional Trades</h1>
          <p className="text-muted mt-1">Track your long calls and puts</p>
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
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Directional Trades</h1>
          <p className="text-muted mt-1">Track your long calls and puts</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportDirectionalToCSV(trades)}
            className="btn-secondary"
            disabled={trades.length === 0}
          >
            Export CSV
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            + New Trade
          </button>
        </div>
      </div>

      {/* Stats */}
      {isLoading ? (
        <SkeletonStatCards count={5} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total P/L"
            value={formatCurrency(coreStats.totalPL)}
            variant={coreStats.totalPL >= 0 ? 'profit' : 'loss'}
            subValue={`${coreStats.closedCount} closed`}
          />
          <StatCard
            label="Capital Deployed"
            value={formatCurrency(stats.capitalDeployed)}
            subValue={`${openTrades.length} open`}
          />
          <StatCard
            label="Open Positions"
            value={openTrades.length.toString()}
            subValue={`${openTrades.reduce((sum, t) => sum + t.contracts, 0)} contracts`}
          />
          <StatCard
            label="Win Rate"
            value={coreStats.closedCount > 0 ? `${coreStats.winRate.toFixed(0)}%` : '-'}
            variant="accent"
            subValue={coreStats.closedCount > 0 ? `${coreStats.wins}/${coreStats.closedCount}` : 'No closed yet'}
          />
          <StatCard
            label="Total Trades"
            value={trades.length.toString()}
            subValue="All time"
          />
        </div>
      )}

      {/* Table */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">All Directional Trades</h2>
          <span className="text-muted text-sm">{trades.length} total</span>
        </div>
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : (
          <DirectionalTable
            trades={trades}
            onClose={(trade) => setCloseModalTrade(trade)}
            onEdit={(trade) => setEditModalTrade(trade)}
            onDelete={handleDeleteTrade}
            onViewRollChain={(chainId) => setRollChainId(chainId)}
          />
        )}
      </div>

      {/* Modals */}
      <AddDirectionalModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddTrade}
      />
      <EditDirectionalModal
        isOpen={!!editModalTrade}
        trade={editModalTrade}
        onClose={() => setEditModalTrade(null)}
        onSubmit={editTrade}
      />
      <CloseDirectionalModal
        isOpen={!!closeModalTrade}
        trade={closeModalTrade}
        onClose={() => setCloseModalTrade(null)}
        onSubmit={handleCloseTrade}
        onPartialClose={handlePartialClose}
        onRoll={handleRollTrade}
      />
      <ConfirmModal
        isOpen={!!deleteModalTrade}
        title="Delete Trade"
        message={deleteModalTrade ? `Delete ${deleteModalTrade.ticker} $${deleteModalTrade.strike}${deleteModalTrade.optionType === 'call' ? 'C' : 'P'}?` : ''}
        onConfirm={confirmDeleteTrade}
        onCancel={() => setDeleteModalTrade(null)}
      />
      <RollHistoryModal
        isOpen={!!rollChainId}
        onClose={() => setRollChainId(null)}
        chain={rollChainId ? getRollChain(rollChainId) : []}
        tradeType="directional"
      />
    </div>
  );
}
