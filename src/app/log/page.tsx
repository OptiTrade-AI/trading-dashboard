'use client';

import { useState, useMemo } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { TradeTable } from '@/components/TradeTable';
import { AddTradeModal, EditTradeModal, CloseTradeModal } from '@/components/TradeModal';
import { RollHistoryModal } from '@/components/RollHistoryModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { StatCard } from '@/components/StatCard';
import { SkeletonStatCards, SkeletonTable, ErrorState } from '@/components/SkeletonLoader';
import { Trade, ExitReason } from '@/types';
import { useHoldings } from '@/hooks/useHoldings';
import { exportToCSV, calculatePL } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';

export default function TradeLog() {
  const { formatCurrency } = useFormatters();
  const { trades, openTrades, closedTrades, addTrade, editTrade, closeTrade, deleteTrade, rollTrade, partialCloseTrade, getRollChain, isLoading, error, retry } = useTrades();
  const { addHolding } = useHoldings();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editModalTrade, setEditModalTrade] = useState<Trade | null>(null);
  const [closeModalTrade, setCloseModalTrade] = useState<Trade | null>(null);
  const [deleteConfirmTrade, setDeleteConfirmTrade] = useState<Trade | null>(null);
  const [rollChainId, setRollChainId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalPL = closedTrades.reduce((sum, t) => sum + calculatePL(t), 0);
    const totalPremium = trades.reduce((sum, t) => sum + t.premiumCollected, 0);
    const totalCollateral = openTrades.reduce((sum, t) => sum + t.collateral, 0);
    const winningTrades = closedTrades.filter((t) => calculatePL(t) > 0).length;
    const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;

    return { totalPL, totalPremium, totalCollateral, winRate, winningTrades };
  }, [trades, openTrades, closedTrades]);

  const handleAddTrade = (trade: Omit<Trade, 'id' | 'dteAtEntry' | 'collateral' | 'status'>) => {
    addTrade(trade);
  };

  const handleCloseTrade = (exitPrice: number, exitDate: string, exitReason: ExitReason) => {
    if (closeModalTrade) {
      closeTrade(closeModalTrade.id, exitPrice, exitDate, exitReason);
      if (exitReason === 'assigned') {
        addHolding({
          ticker: closeModalTrade.ticker,
          shares: closeModalTrade.contracts * 100,
          costBasisPerShare: closeModalTrade.strike,
          acquiredDate: exitDate,
          notes: `Auto: ${closeModalTrade.ticker} $${closeModalTrade.strike}P assigned`,
        });
      }
      setCloseModalTrade(null);
    }
  };

  const handleRollTrade = (exitPrice: number, exitDate: string, newTrade: Omit<Trade, 'id' | 'dteAtEntry' | 'collateral' | 'status' | 'rollChainId' | 'rollNumber'>) => {
    if (closeModalTrade) {
      rollTrade(closeModalTrade.id, exitPrice, exitDate, newTrade);
      setCloseModalTrade(null);
    }
  };

  const handlePartialClose = (contractsToClose: number, exitPrice: number, exitDate: string, exitReason: ExitReason) => {
    if (closeModalTrade) {
      partialCloseTrade(closeModalTrade.id, contractsToClose, exitPrice, exitDate, exitReason);
      if (exitReason === 'assigned') {
        addHolding({
          ticker: closeModalTrade.ticker,
          shares: contractsToClose * 100,
          costBasisPerShare: closeModalTrade.strike,
          acquiredDate: exitDate,
          notes: `Auto: ${closeModalTrade.ticker} $${closeModalTrade.strike}P partially assigned (${contractsToClose} contracts)`,
        });
      }
      setCloseModalTrade(null);
    }
  };

  const handleDeleteTrade = () => {
    if (deleteConfirmTrade) {
      deleteTrade(deleteConfirmTrade.id);
      setDeleteConfirmTrade(null);
    }
  };

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Trade Log</h1>
          <p className="text-muted mt-1">Cash-secured puts</p>
        </div>
        <ErrorState message={error} onRetry={retry} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Trade Log</h1>
          <p className="text-muted mt-1">Cash-secured puts</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportToCSV(trades)}
            className="btn-secondary"
            disabled={trades.length === 0}
          >
            Export CSV
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary"
          >
            + Add Trade
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
            label="Total Premium"
            value={formatCurrency(stats.totalPremium)}
            variant="profit"
            subValue="All time"
          />
          <StatCard
            label="Open Positions"
            value={openTrades.length.toString()}
            subValue={formatCurrency(stats.totalCollateral) + ' collateral'}
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
            subValue={`${openTrades.length} open · ${closedTrades.length} closed`}
          />
        </div>
      )}

      {/* Table */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">All CSP Trades</h2>
          <span className="text-muted text-sm">{trades.length} total</span>
        </div>
        {isLoading ? (
          <SkeletonTable rows={6} />
        ) : (
          <TradeTable
            trades={trades}
            onClose={(trade) => setCloseModalTrade(trade)}
            onEdit={(trade) => setEditModalTrade(trade)}
            onDelete={(trade) => setDeleteConfirmTrade(trade)}
            onViewRollChain={(chainId) => setRollChainId(chainId)}
          />
        )}
      </div>

      <AddTradeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddTrade}
      />

      <EditTradeModal
        isOpen={!!editModalTrade}
        trade={editModalTrade}
        onClose={() => setEditModalTrade(null)}
        onSubmit={editTrade}
      />

      <CloseTradeModal
        isOpen={!!closeModalTrade}
        trade={closeModalTrade}
        onClose={() => setCloseModalTrade(null)}
        onSubmit={handleCloseTrade}
        onRoll={handleRollTrade}
        onPartialClose={handlePartialClose}
      />

      <RollHistoryModal
        isOpen={!!rollChainId}
        onClose={() => setRollChainId(null)}
        chain={rollChainId ? getRollChain(rollChainId) : []}
        tradeType="csp"
      />

      <ConfirmModal
        isOpen={!!deleteConfirmTrade}
        title="Delete Trade"
        message={deleteConfirmTrade ? `Delete ${deleteConfirmTrade.ticker} $${deleteConfirmTrade.strike}P? This cannot be undone.` : ''}
        onConfirm={handleDeleteTrade}
        onCancel={() => setDeleteConfirmTrade(null)}
      />
    </div>
  );
}
