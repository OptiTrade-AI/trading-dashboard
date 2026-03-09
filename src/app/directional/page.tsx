'use client';

import { useState, useMemo } from 'react';
import { useDirectionalTrades } from '@/hooks/useDirectionalTrades';
import { DirectionalTable } from '@/components/DirectionalTable';
import { AddDirectionalModal, CloseDirectionalModal } from '@/components/DirectionalModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { RollHistoryModal } from '@/components/RollHistoryModal';
import { StatCard } from '@/components/StatCard';
import { SkeletonStatCards, SkeletonTable, ErrorState } from '@/components/SkeletonLoader';
import { DirectionalTrade, DirectionalExitReason } from '@/types';
import { formatCurrency, calculateDirectionalPL, exportDirectionalToCSV } from '@/lib/utils';

export default function DirectionalPage() {
  const { trades, openTrades, closedTrades, addTrade, closeTrade, deleteTrade, rollTrade, partialCloseTrade, getRollChain, isLoading, error, retry } = useDirectionalTrades();
  const [showAddModal, setShowAddModal] = useState(false);
  const [closeModalTrade, setCloseModalTrade] = useState<DirectionalTrade | null>(null);
  const [deleteModalTrade, setDeleteModalTrade] = useState<DirectionalTrade | null>(null);
  const [rollChainId, setRollChainId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalPL = closedTrades.reduce((sum, t) => sum + calculateDirectionalPL(t), 0);
    const capitalDeployed = openTrades.reduce((sum, t) => sum + t.costAtOpen, 0);
    const winningTrades = closedTrades.filter((t) => calculateDirectionalPL(t) > 0).length;
    const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;

    return { totalPL, capitalDeployed, winRate, winningTrades };
  }, [openTrades, closedTrades]);

  const handleAddTrade = (trade: Omit<DirectionalTrade, 'id' | 'dteAtEntry' | 'costAtOpen' | 'status'>) => {
    addTrade(trade);
  };

  const handleCloseTrade = (exitPrice: number, exitDate: string, exitReason: DirectionalExitReason) => {
    if (closeModalTrade) {
      closeTrade(closeModalTrade.id, exitPrice, exitDate, exitReason);
      setCloseModalTrade(null);
    }
  };

  const handleRollTrade = (exitPrice: number, exitDate: string, newTrade: Omit<DirectionalTrade, 'id' | 'dteAtEntry' | 'costAtOpen' | 'status' | 'rollChainId' | 'rollNumber'>) => {
    if (closeModalTrade) {
      rollTrade(closeModalTrade.id, exitPrice, exitDate, newTrade);
      setCloseModalTrade(null);
    }
  };

  const handlePartialClose = (contractsToClose: number, exitPrice: number, exitDate: string, exitReason: DirectionalExitReason) => {
    if (closeModalTrade) {
      partialCloseTrade(closeModalTrade.id, contractsToClose, exitPrice, exitDate, exitReason);
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
            value={formatCurrency(stats.totalPL)}
            variant={stats.totalPL >= 0 ? 'profit' : 'loss'}
            subValue={`${closedTrades.length} closed`}
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
            value={closedTrades.length > 0 ? `${stats.winRate.toFixed(0)}%` : '-'}
            variant="accent"
            subValue={closedTrades.length > 0 ? `${stats.winningTrades}/${closedTrades.length}` : 'No closed yet'}
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
