'use client';

import { useState, useMemo } from 'react';
import { useCoveredCalls } from '@/hooks/useCoveredCalls';
import { useTradeStats } from '@/hooks/useTradeStats';
import { calculateCCPL } from '@/lib/utils';
import { CCTable } from '@/components/CCTable';
import { AddCCModal, EditCCModal, CloseCCModal } from '@/components/CCModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { RollHistoryModal } from '@/components/RollHistoryModal';
import { StatCard } from '@/components/StatCard';
import { SkeletonStatCards, SkeletonTable, ErrorState } from '@/components/SkeletonLoader';
import { useStockEvents } from '@/hooks/useStockEvents';
import { useHoldings } from '@/hooks/useHoldings';
import { CoveredCall, CCExitReason } from '@/types';
import { exportCCToCSV } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';

export default function CoveredCallsPage() {
  const { formatCurrency } = useFormatters();
  const { calls, openCalls, closedCalls, addCall, editCall, closeCall, deleteCall, rollCall, partialCloseCall, getRollChain, isLoading, error, retry } = useCoveredCalls();
  const { addStockEvent } = useStockEvents();
  const { getCostBasis, removeShares } = useHoldings();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editModalCall, setEditModalCall] = useState<CoveredCall | null>(null);
  const [closeModalCall, setCloseModalCall] = useState<CoveredCall | null>(null);
  const [deleteModalCall, setDeleteModalCall] = useState<CoveredCall | null>(null);
  const [rollChainId, setRollChainId] = useState<string | null>(null);

  const coreStats = useTradeStats(openCalls, closedCalls, calculateCCPL);

  const stats = useMemo(() => {
    const totalPremium = calls.reduce((sum, c) => sum + c.premiumCollected, 0);
    const calledAway = closedCalls.filter((c) => c.status === 'called').length;
    return { totalPremium, calledAway };
  }, [calls, closedCalls]);

  const handleAddCall = (call: Omit<CoveredCall, 'id' | 'dteAtEntry' | 'sharesHeld' | 'status'>) => {
    addCall(call);
  };

  const handleCloseCall = (exitPrice: number, exitDate: string, exitReason: CCExitReason, wasCalled: boolean, closeCommission?: number) => {
    if (closeModalCall) {
      closeCall(closeModalCall.id, exitPrice, exitDate, exitReason, wasCalled, closeCommission);
      if (wasCalled) {
        const shares = closeModalCall.contracts * 100;
        removeShares(closeModalCall.ticker, shares);
        const costPerShare = closeModalCall.costBasis / shares;
        addStockEvent({
          ticker: closeModalCall.ticker,
          shares,
          costBasis: costPerShare,
          salePrice: closeModalCall.strike,
          saleDate: exitDate,
          isTaxLossHarvest: closeModalCall.strike < costPerShare,
          notes: `Auto: ${closeModalCall.ticker} $${closeModalCall.strike}C assigned`,
        });
      }
      setCloseModalCall(null);
    }
  };

  const handleRollCall = (exitPrice: number, exitDate: string, newCall: Omit<CoveredCall, 'id' | 'dteAtEntry' | 'sharesHeld' | 'status' | 'rollChainId' | 'rollNumber'>) => {
    if (closeModalCall) {
      rollCall(closeModalCall.id, exitPrice, exitDate, newCall);
      setCloseModalCall(null);
    }
  };

  const handlePartialClose = (contractsToClose: number, exitPrice: number, exitDate: string, exitReason: CCExitReason, wasCalled: boolean, closeCommission?: number) => {
    if (closeModalCall) {
      partialCloseCall(closeModalCall.id, contractsToClose, exitPrice, exitDate, exitReason, wasCalled, closeCommission);
      if (wasCalled) {
        const shares = contractsToClose * 100;
        removeShares(closeModalCall.ticker, shares);
        const costPerShare = closeModalCall.costBasis / (closeModalCall.contracts * 100);
        addStockEvent({
          ticker: closeModalCall.ticker,
          shares,
          costBasis: costPerShare,
          salePrice: closeModalCall.strike,
          saleDate: exitDate,
          isTaxLossHarvest: closeModalCall.strike < costPerShare,
          notes: `Auto: ${closeModalCall.ticker} $${closeModalCall.strike}C partially assigned (${contractsToClose} contracts)`,
        });
      }
      setCloseModalCall(null);
    }
  };

  const handleDeleteCall = (call: CoveredCall) => {
    setDeleteModalCall(call);
  };

  const confirmDeleteCall = () => {
    if (deleteModalCall) {
      deleteCall(deleteModalCall.id);
      setDeleteModalCall(null);
    }
  };

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Covered Calls</h1>
          <p className="text-muted mt-1">Track your covered call positions</p>
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
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Covered Calls</h1>
          <p className="text-muted mt-1">Track your covered call positions</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportCCToCSV(calls)}
            className="btn-secondary"
            disabled={calls.length === 0}
          >
            Export CSV
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            + New CC
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
            label="Total Premium"
            value={formatCurrency(stats.totalPremium)}
            variant="profit"
            subValue="All time"
          />
          <StatCard
            label="Open Positions"
            value={openCalls.length.toString()}
            subValue={`${openCalls.reduce((sum, c) => sum + c.sharesHeld, 0)} shares`}
          />
          <StatCard
            label="Win Rate"
            value={coreStats.closedCount > 0 ? `${coreStats.winRate.toFixed(0)}%` : '-'}
            variant="accent"
            subValue={coreStats.closedCount > 0 ? `${coreStats.wins}/${coreStats.closedCount}` : 'No closed yet'}
          />
          <StatCard
            label="Called Away"
            value={stats.calledAway.toString()}
            subValue="Shares assigned"
          />
        </div>
      )}

      {/* Table */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">All Covered Calls</h2>
          <span className="text-muted text-sm">{calls.length} total</span>
        </div>
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : (
          <CCTable
            calls={calls}
            onClose={(call) => setCloseModalCall(call)}
            onEdit={(call) => setEditModalCall(call)}
            onDelete={handleDeleteCall}
            onViewRollChain={(chainId) => setRollChainId(chainId)}
          />
        )}
      </div>

      {/* Modals */}
      <AddCCModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddCall}
        getCostBasis={getCostBasis}
      />
      <EditCCModal
        isOpen={!!editModalCall}
        call={editModalCall}
        onClose={() => setEditModalCall(null)}
        onSubmit={editCall}
      />
      <CloseCCModal
        isOpen={!!closeModalCall}
        call={closeModalCall}
        onClose={() => setCloseModalCall(null)}
        onSubmit={handleCloseCall}
        onRoll={handleRollCall}
        onPartialClose={handlePartialClose}
      />
      <ConfirmModal
        isOpen={!!deleteModalCall}
        title="Delete Covered Call"
        message={deleteModalCall ? `Delete ${deleteModalCall.ticker} $${deleteModalCall.strike}C?` : ''}
        onConfirm={confirmDeleteCall}
        onCancel={() => setDeleteModalCall(null)}
      />
      <RollHistoryModal
        isOpen={!!rollChainId}
        onClose={() => setRollChainId(null)}
        chain={rollChainId ? getRollChain(rollChainId) : []}
        tradeType="cc"
      />
    </div>
  );
}
