import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataTable, { type DataTableColumn } from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import { MigrationApi } from '../services/api';
import type { DecommissionBoxMetric } from '../types';
import { DollarSign, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function DecommissionPage({ maId }: { maId?: string }) {
  const [boxes, setBoxes] = useState<DecommissionBoxMetric[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDecommBoxes = async () => {
    setLoading(true);
    try {
      const data = await MigrationApi.listDecommissionBoxes(maId);
      setBoxes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecommBoxes();
  }, [maId]);

  const readyBoxes = boxes.filter((b) => b.releaseStatus === 'READY_FOR_RELEASE');
  const blockedBoxes = boxes.filter((b) => b.releaseStatus === 'BLOCKED_BY_ROLLBACK');
  const monthlySavings = readyBoxes.length * 350;

  const columns: DataTableColumn<DecommissionBoxMetric>[] = [
    {
      key: 'box',
      header: 'Caixa Origem (Alugada)',
      render: (r) => (
        <span className="font-mono font-bold text-xs text-[#2E2D39] bg-[#F5F5F8] px-2 py-1 rounded border border-[#E8E8EE]">
          {r.originBoxId}
        </span>
      ),
    },
    {
      key: 'provider',
      header: 'Provedor de Origem',
      render: (r) => <span className="font-semibold text-xs text-[#514F66]">{r.originProvider}</span>,
    },
    {
      key: 'total',
      header: 'Total Clientes',
      render: (r) => r.totalCustomers,
    },
    {
      key: 'migrated',
      header: 'Migrados (V.tal)',
      render: (r) => <span className="font-semibold text-emerald-600">{r.migratedCustomers}</span>,
    },
    {
      key: 'pending',
      header: 'Pendentes',
      render: (r) => (
        <span className={r.pendingCustomers > 0 ? 'text-amber-600 font-semibold' : 'text-[#8A8899]'}>
          {r.pendingCustomers}
        </span>
      ),
    },
    {
      key: 'rollbacks',
      header: 'Rollbacks',
      render: (r) =>
        r.rollbackCustomers > 0 ? (
          <span className="text-red-600 font-bold">{r.rollbackCustomers}</span>
        ) : (
          <span className="text-[#8A8899]">0</span>
        ),
    },
    {
      key: 'status',
      header: 'Status de Liberação',
      render: (r) => <StatusPill status={r.releaseStatus} />,
    },
    {
      key: 'savings',
      header: 'Economia Projetada',
      render: (r) =>
        r.releaseStatus === 'READY_FOR_RELEASE' ? (
          <span className="text-xs font-bold text-emerald-600">R$ 350,00 / mês</span>
        ) : (
          <span className="text-xs text-[#8A8899]">—</span>
        ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[#2E2D39]">Pós-Migração & Desmobilização de Infraestrutura</h1>
        <p className="text-xs text-[#8A8899]">
          Controle de devolução e encerramento de aluguel de caixas (CDO/CDOI) e elementos passivos da rede de origem
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="vt-card p-5 bg-gradient-to-br from-white to-[#FAFAFB]">
          <div className="flex items-center justify-between text-[#8A8899]">
            <span className="text-xs font-semibold">Caixas Prontas para Devolução</span>
            <CheckCircle2 size={18} className="text-[#10B981]" />
          </div>
          <div className="text-3xl font-bold text-[#10B981] mt-2">{readyBoxes.length}</div>
          <p className="text-xs text-[#514F66] mt-1">100% dos clientes transpostos com sucesso para a V.tal.</p>
        </div>

        <div className="vt-card p-5 bg-gradient-to-br from-white to-[#FAFAFB]">
          <div className="flex items-center justify-between text-[#8A8899]">
            <span className="text-xs font-semibold">Economia Mensal Direta</span>
            <DollarSign size={18} className="text-[#FFD919]" />
          </div>
          <div className="text-3xl font-bold text-[#2E2D39] mt-2">
            R$ {monthlySavings.toLocaleString('pt-BR')},00
          </div>
          <p className="text-xs text-[#514F66] mt-1">Redução no custo mensal de aluguel de infraestrutura.</p>
        </div>

        <div className="vt-card p-5 bg-gradient-to-br from-white to-[#FAFAFB]">
          <div className="flex items-center justify-between text-[#8A8899]">
            <span className="text-xs font-semibold">Bloqueadas por Rollback</span>
            <AlertTriangle size={18} className="text-[#DC2626]" />
          </div>
          <div className="text-3xl font-bold text-[#DC2626] mt-2">{blockedBoxes.length}</div>
          <p className="text-xs text-[#514F66] mt-1">Caixas que ainda possuem clientes reconectados na rede legada.</p>
        </div>
      </div>

      {/* Table */}
      <Card
        title="Painel de Infraestrutura de Origem Potencialmente Liberável"
        subtitle="Rastreabilidade por elemento físico da operadora de origem para cancelamento de contratos de aluguel"
        actions={
          <Button variant="ghost" size="sm" onClick={fetchDecommBoxes}>
            <RefreshCw size={14} />
          </Button>
        }
        noPadding
      >
        <DataTable
          columns={columns}
          rows={boxes}
          rowKey={(r) => r.originBoxId}
          loading={loading}
          emptyMessage="Nenhuma caixa de origem identificada nos lotes importados."
        />
      </Card>
    </div>
  );
}
