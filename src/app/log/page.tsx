'use client';

import { useState } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { TradeTable } from '@/components/TradeTable';
import { AddTradeModal, CloseTradeModal } from '@/components/TradeModal';
import { RollHistoryModal } from '@/components/RollHistoryModal';
import { SkeletonTable, ErrorState } from '@/components/SkeletonLoader';
import { Trade, ExitReason } from '@/types';
import { exportToCSV } from '@/lib/utils';

export default function TradeLog() {
  const { trades, addTrade, closeTrade, deleteTrade, rollTrade, partialCloseTrade, getRollChain, isLoading, error, retry } = useTrades();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [closeModalTrade, setCloseModalTrade] = useState<Trade | null>(null);
  const [deleteConfirmTrade, setDeleteConfirmTrade] = useState<Trade | null>(null);
  const [rollChainId, setRollChainId] = useState<string | null>(null);

  const handleAddTrade = (trade: Omit<Trade, 'id' | 'dteAtEntry' | 'collateral' | 'status'>) => {
    addTrade(trade);
  };

  const handleCloseTrade = (exitPrice: number, exitDate: string, exitReason: ExitReason) => {
    if (closeModalTrade) {
      closeTrade(closeModalTrade.id, exitPrice, exitDate, exitReason);
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

  const openCount = trades.filter(t => t.status === 'open').length;
  const closedCount = trades.filter(t => t.status === 'closed').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Trade Log</h1>
          {isLoading ? (
            <div className="h-5 w-48 animate-pulse rounded bg-zinc-800/60 mt-1" />
          ) : (
            <p className="text-muted mt-1">
              {trades.length} total trades · {openCount} open · {closedCount} closed
            </p>
          )}
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

      {/* Table */}
      <div className="glass-card p-5">
        {isLoading ? (
          <SkeletonTable rows={6} />
        ) : (
          <TradeTable
            trades={trades}
            onClose={(trade) => setCloseModalTrade(trade)}
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmTrade && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card w-full max-w-sm p-6">
            <div className="w-12 h-12 rounded-xl bg-loss/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-loss text-xl">⚠</span>
            </div>
            <h3 className="text-xl font-semibold text-foreground text-center mb-2">Delete Trade</h3>
            <p className="text-muted text-center mb-6">
              Are you sure you want to delete <span className="text-foreground font-medium">{deleteConfirmTrade.ticker} ${deleteConfirmTrade.strike}P</span>? This cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteConfirmTrade(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTrade}
                className="flex-1 py-2.5 text-sm font-semibold bg-loss text-white rounded-xl hover:bg-loss/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
