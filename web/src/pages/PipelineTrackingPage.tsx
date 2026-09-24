import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { MigrationApi } from '../services/api';
import type { DashboardMetrics, MigrationLot } from '../types';
import {
  Activity,
  UploadCloud,
  Filter,
  FileSpreadsheet,
  CalendarDays,
  HardHat,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Layers,
} from 'lucide-react';

interface PipelineTrackingPageProps {
  maId?: string;
  onNavigate: (tab: any) => void;
}

export default function PipelineTrackingPage({ maId, onNavigate }: PipelineTrackingPageProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [lots, setLots] = useState<MigrationLot[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!maId) return;
    setLoading(true);
    try {
      const [m, l] = await Promise.all([
        MigrationApi.getDashboardMetrics(maId),
        MigrationApi.listLots(maId),
      ]);
      setMetrics(m);
      setLots(l);
    } catch (e) {
      console.error('Falha ao carregar esteira do M&A', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [maId]);

  if (!maId) {
    return (
      <div className="p-8 text-center text-[#8A8899]">
        Selecione um M&A no topo para acompanhar a esteira operacional.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              Operacional
            </span>
            <h1 className="text-xl font-bold text-[#2E2D39]">Gestão de Esteira de Migração</h1>
          </div>
          <p className="text-xs text-[#8A8899] mt-1">
            Visão consolidada da esteira da onda selecionada por lote e fluxo end-to-end
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} loading={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </Button>
          <Button variant="primary" size="sm" onClick={() => onNavigate('import')}>
            <UploadCloud size={14} className="mr-1" />
            Importar Novo Lote
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="vt-card p-3">
            <span className="text-[11px] font-semibold text-[#8A8899]">Total Importado</span>
            <div className="text-xl font-bold text-[#2E2D39] mt-1">
              {metrics.totalAcquired.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-slate-500">{lots.length} lotes</span>
          </div>

          <div className="vt-card p-3">
            <span className="text-[11px] font-semibold text-[#8A8899]">Viabilidade Técnica</span>
            <div className="text-xl font-bold text-emerald-700 mt-1">
              {metrics.totalViable.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-emerald-600">Com CDO V.tal</span>
          </div>

          <div className="vt-card p-3">
            <span className="text-[11px] font-semibold text-[#8A8899]">OS / SA Criadas</span>
            <div className="text-xl font-bold text-amber-700 mt-1">
              {(metrics.totalOsOpen ?? metrics.totalOsCreated).toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-amber-600">Prontos p/ Campo</span>
          </div>

          <div className="vt-card p-3">
            <span className="text-[11px] font-semibold text-[#8A8899]">Programados</span>
            <div className="text-xl font-bold text-purple-700 mt-1">
              {metrics.totalScheduled.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-purple-600">Em CDOs agendadas</span>
          </div>

          <div className="vt-card p-3">
            <span className="text-[11px] font-semibold text-[#8A8899]">Em Campo</span>
            <div className="text-xl font-bold text-indigo-700 mt-1">
              {metrics.totalInField.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-indigo-600">Atividades no dia</span>
          </div>

          <div className="vt-card p-3">
            <span className="text-[11px] font-semibold text-[#8A8899]">Migrados OK</span>
            <div className="text-xl font-bold text-emerald-800 mt-1">
              {metrics.totalMigrated.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-emerald-700">{metrics.migrationPercentage}% concluído</span>
          </div>

          <div className="vt-card p-3">
            <span className="text-[11px] font-semibold text-[#8A8899]">Exceções / Falhas</span>
            <div className="text-xl font-bold text-rose-600 mt-1">
              {metrics.totalExceptions.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-rose-500">Pendentes de ação</span>
          </div>
        </div>
      )}

      {/* Table of Lots */}
      <Card
        title="Lotes de Importação"
        subtitle="Relação de arquivos CSV importados para esta onda"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onNavigate('triagem')}>
              <Filter size={13} className="mr-1" />
              Ir para Qualificação
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto border border-[#E9E8F2] rounded-md">
          <table className="vt-table w-full">
            <thead>
              <tr>
                <th className="whitespace-nowrap min-w-[150px]">ID Lote</th>
                <th className="whitespace-nowrap">Importação</th>
                <th className="!text-center whitespace-nowrap" style={{ textAlign: 'center' }}>Total</th>
                <th className="!text-center whitespace-nowrap" style={{ textAlign: 'center' }}>Válidos</th>
                <th className="!text-center whitespace-nowrap" style={{ textAlign: 'center' }}>Rejeitados</th>
                <th className="!text-center whitespace-nowrap" style={{ textAlign: 'center' }}>Duplicados</th>
                <th className="!text-center whitespace-nowrap" style={{ textAlign: 'center' }}>Status</th>
                <th className="!text-center whitespace-nowrap" style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lots.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-[#8A8899]">
                    Nenhum lote importado ainda para esta onda. Clique em "Importar Novo Lote" para iniciar.
                  </td>
                </tr>
              ) : (
                lots.map((lot) => (
                  <tr key={lot.id} className="hover:bg-[#F8F7FC] transition-colors">
                    <td className="font-mono text-xs font-bold text-[#2E2D39] whitespace-nowrap">{lot.id}</td>
                    <td className="text-xs text-[#8A8899] whitespace-nowrap">
                      {new Date(lot.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="!text-center font-medium whitespace-nowrap" style={{ textAlign: 'center' }}>{lot.totalRecords.toLocaleString('pt-BR')}</td>
                    <td className="!text-center text-emerald-700 font-medium whitespace-nowrap" style={{ textAlign: 'center' }}>
                      {lot.validRecords.toLocaleString('pt-BR')}
                    </td>
                    <td className="!text-center text-rose-600 font-medium whitespace-nowrap" style={{ textAlign: 'center' }}>
                      {lot.rejectedRecords.toLocaleString('pt-BR')}
                    </td>
                    <td className="!text-center text-amber-600 font-medium whitespace-nowrap" style={{ textAlign: 'center' }}>
                      {lot.duplicateRecords.toLocaleString('pt-BR')}
                    </td>
                    <td className="!text-center whitespace-nowrap" style={{ textAlign: 'center' }}>
                      {(() => {
                        switch (lot.importStatus) {
                          case 'RECEIVED':
                          case 'PENDING':
                            return <Badge tone="blue" dot>Recebido</Badge>;
                          case 'SANITIZING':
                          case 'PREPARING':
                          case 'PROCESSING':
                            return <Badge tone="amber" dot>Higienizando</Badge>;
                          case 'ANALYZING_VIABILITY':
                            return <Badge tone="purple" dot>Análise Viabilidade</Badge>;
                          case 'OPENING_OS':
                            return <Badge tone="brand" dot>Em Abertura de OS's</Badge>;
                          case 'COMPLETED':
                            return <Badge tone="green" dot>Finalizado</Badge>;
                          case 'FAILED':
                            return <Badge tone="red" dot>Falhou</Badge>;
                          default:
                            return <Badge tone="neutral" dot>{lot.importStatus}</Badge>;
                        }
                      })()}
                    </td>
                    <td className="text-center whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onNavigate('triagem')}
                        className="text-xs"
                      >
                        Qualificação
                        <ArrowRight size={12} className="ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
