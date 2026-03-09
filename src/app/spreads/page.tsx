'use client';

import { useState, useMemo } from 'react';
import { useSpreads } from '@/hooks/useSpreads';
import { SpreadsTable } from '@/components/SpreadsTable';
import { AddSpreadModal, CloseSpreadModal } from '@/components/SpreadsModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { RollHistoryModal } from '@/components/RollHistoryModal';
import { StatCard } from '@/components/StatCard';
import { SkeletonStatCards, SkeletonTable, ErrorState } from '@/components/SkeletonLoader';
import { SpreadTrade, SpreadExitReason } from '@/types';
import { formatCurrency, calculateSpreadPL, exportSpreadsToCSV } from '@/lib/utils';

export default function SpreadsPage() {
  const { spreads, openSpreads, closedSpreads, addSpread, closeSpread, deleteSpread, rollSpread, partialCloseSpread, getRollChain, isLoading, error, retry } = useSpreads();
  const [showAddModal, setShowAddModal] = useState(false);
  const [closeModalTrade, setCloseModalTrade] = useState<SpreadTrade | null>(null);
  const [deleteModalTrade, setDeleteModalTrade] = useState<SpreadTrade | null>(null);
  const [rollChainId, setRollChainId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalPL = closedSpreads.reduce((sum, t) => sum + calculateSpreadPL(t), 0);
    const capitalAtRisk = openSpreads.reduce((sum, t) => sum + t.maxLoss, 0);
    const winningTrades = closedSpreads.filter((t) => calculateSpreadPL(t) > 0).length;
    const winRate = closedSpreads.length > 0 ? (winningTrades / closedSpreads.length) * 100 : 0;

    return { totalPL, capitalAtRisk, winRate, winningTrades };
  }, [openSpreads, closedSpreads]);

  const handleAddSpread = (trade: Omit<SpreadTrade, 'id' | 'dteAtEntry' | 'netDebit' | 'maxProfit' | 'maxLoss' | 'status'>) => {
    addSpread(trade);
  };

  const handleCloseSpread = (closeNetCredit: number, exitDate: string, exitReason: SpreadExitReason) => {
    if (closeModalTrade) {
      closeSpread(closeModalTrade.id, closeNetCredit, exitDate, exitReason);
      setCloseModalTrade(null);
    }
  };

  const handleRollSpread = (closeNetCredit: number, exitDate: string, newSpread: Omit<SpreadTrade, 'id' | 'dteAtEntry' | 'netDebit' | 'maxProfit' | 'maxLoss' | 'status' | 'rollChainId' | 'rollNumber'>) => {
    if (closeModalTrade) {
      rollSpread(closeModalTrade.id, closeNetCredit, exitDate, newSpread);
      setCloseModalTrade(null);
    }
  };

  const handlePartialClose = (contractsToClose: number, closeNetCredit: number, exitDate: string, exitReason: SpreadExitReason) => {
    if (closeModalTrade) {
      partialCloseSpread(closeModalTrade.id, contractsToClose, closeNetCredit, exitDate, exitReason);
      setCloseModalTrade(null);
    }
  };

  const handleDeleteSpread = (trade: SpreadTrade) => {
    setDeleteModalTrade(trade);
  };

  const confirmDeleteSpread = () => {
    if (deleteModalTrade) {
      deleteSpread(deleteModalTrade.id);
      setDeleteModalTrade(null);
    }
  };

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Spread Trades</h1>
          <p className="text-muted mt-1">Track your vertical spreads</p>
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
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Spread Trades</h1>
          <p className="text-muted mt-1">Track your vertical spreads</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportSpreadsToCSV(spreads)}
            className="btn-secondary"
            disabled={spreads.length === 0}
          >
            Export CSV
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            + New Spread
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
            subValue={`${closedSpreads.length} closed`}
          />
          <StatCard
            label="Capital at Risk"
            value={formatCurrency(stats.capitalAtRisk)}
            subValue={`${openSpreads.length} open`}
          />
          <StatCard
            label="Open Positions"
            value={openSpreads.length.toString()}
            subValue={`${openSpreads.reduce((sum, t) => sum + t.contracts, 0)} contracts`}
          />
          <StatCard
            label="Win Rate"
            value={closedSpreads.length > 0 ? `${stats.winRate.toFixed(0)}%` : '-'}
            variant="accent"
            subValue={closedSpreads.length > 0 ? `${stats.winningTrades}/${closedSpreads.length}` : 'No closed yet'}
          />
          <StatCard
            label="Total Trades"
            value={spreads.length.toString()}
            subValue="All time"
          />
        </div>
      )}

      {/* Table */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">All Spread Trades</h2>
          <span className="text-muted text-sm">{spreads.length} total</span>
        </div>
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : (
          <SpreadsTable
            trades={spreads}
            onClose={(trade) => setCloseModalTrade(trade)}
            onDelete={handleDeleteSpread}
            onViewRollChain={(chainId) => setRollChainId(chainId)}
          />
        )}
      </div>

      {/* Modals */}
      <AddSpreadModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddSpread}
      />
      <CloseSpreadModal
        isOpen={!!closeModalTrade}
        trade={closeModalTrade}
        onClose={() => setCloseModalTrade(null)}
        onSubmit={handleCloseSpread}
        onPartialClose={handlePartialClose}
        onRoll={handleRollSpread}
      />
      <ConfirmModal
        isOpen={!!deleteModalTrade}
        title="Delete Spread"
        message={deleteModalTrade ? `Delete ${deleteModalTrade.ticker} $${deleteModalTrade.longStrike}/$${deleteModalTrade.shortStrike}?` : ''}
        onConfirm={confirmDeleteSpread}
        onCancel={() => setDeleteModalTrade(null)}
      />
      <RollHistoryModal
        isOpen={!!rollChainId}
        onClose={() => setRollChainId(null)}
        chain={rollChainId ? getRollChain(rollChainId) : []}
        tradeType="spread"
      />
    </div>
  );
}
