import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { MigrationApi } from '../services/api';
import type { StrategicOverviewItem } from '../types';
import {
  Layers,
  Users,
  CheckCircle2,
  CalendarDays,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Building,
} from 'lucide-react';

interface StrategicOverviewPageProps {
  onSelectMa: (maId: string) => void;
  onNavigate: (tab: any) => void;
}

export default function StrategicOverviewPage({ onSelectMa, onNavigate }: StrategicOverviewPageProps) {
  const [data, setData] = useState<StrategicOverviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const items = await MigrationApi.getStrategicOverview();
      setData(items);
    } catch (e) {
      console.error('Falha ao carregar visão geral estratégica', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalMas = data.length;
  const activeMas = data.filter((m) => m.status === 'ACTIVE').length;
  const totalCustomers = data.reduce((acc, curr) => acc + (curr.totalCustomers || 0), 0);
  const totalOsOpen = data.reduce((acc, curr) => acc + (curr.totalOsOpen ?? curr.totalOsCreated ?? 0), 0);
  const totalMigrated = data.reduce((acc, curr) => acc + (curr.totalMigrated || 0), 0);
  const totalExceptions = data.reduce((acc, curr) => acc + (curr.totalExceptions || 0), 0);
  const globalProgress = totalCustomers > 0 ? Math.round((totalMigrated / totalCustomers) * 100) : 0;

  const filteredData = data.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.maName.toLowerCase().includes(q) ||
      item.originProvider.toLowerCase().includes(q) ||
      item.uf.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FFD919]/20 text-[#181919] border border-[#FFD919]/40">
              Estratégico
            </span>
            <h1 className="text-xl font-bold text-[#2E2D39]">Visão Geral das Ondas de Migração</h1>
          </div>
          <p className="text-xs text-[#8A8899] mt-1">
            Consolidado executivo de todas as campanhas de migração física para a rede neutra V.tal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} loading={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </Button>
          <Button variant="primary" size="sm" onClick={() => onNavigate('setup')}>
            <Building size={14} className="mr-1" />
            Gerenciar Ondas
          </Button>
        </div>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="vt-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8A8899]">Ondas Cadastradas</span>
            <Layers size={16} className="text-[#514F66]" />
          </div>
          <div className="text-2xl font-bold text-[#2E2D39] mt-2">{totalMas}</div>
          <div className="text-[11px] text-[#10B981] font-medium mt-0.5">
            {activeMas} ativos em andamento
          </div>
        </div>

        <div className="vt-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8A8899]">Total em Carteira</span>
            <Users size={16} className="text-[#514F66]" />
          </div>
          <div className="text-2xl font-bold text-[#2E2D39] mt-2">
            {totalCustomers.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-[#8A8899] font-medium mt-0.5">
            Clientes importados
          </div>
        </div>

        <div className="vt-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8A8899]">OS / SA Abertas</span>
            <CheckCircle2 size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-[#2E2D39] mt-2">
            {totalOsOpen.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-amber-600 font-medium mt-0.5">
            Abertas 1:1:1 no CRM
          </div>
        </div>

        <div className="vt-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8A8899]">Migrados com Sucesso</span>
            <ShieldCheck size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">
            {totalMigrated.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
            {globalProgress}% de conclusão global
          </div>
        </div>

        <div className="vt-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8A8899]">Total de Exceções</span>
            <AlertTriangle size={16} className="text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2">
            {totalExceptions.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-rose-500 font-medium mt-0.5">
            Endereço / Inviabilidade
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <Card
        title="Quadro Geral"
        subtitle="Acompanhe o andamento consolidado e selecione uma onda para gerenciar a esteira operacional"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <input
            type="text"
            placeholder="Filtrar por nome da onda ou UF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="vt-input max-w-sm text-xs"
          />
          <div className="text-xs text-[#8A8899]">
            Exibindo {filteredData.length} de {data.length} ondas
          </div>
        </div>

        <div className="overflow-x-auto border border-[#E9E8F2] rounded-md">
          <table className="vt-table w-full">
            <thead>
              <tr>
                <th className="w-auto">Onda</th>
                <th className="w-16 text-center whitespace-nowrap">UF</th>
                <th className="w-36 whitespace-nowrap">Status</th>
                <th className="w-24 text-center whitespace-nowrap">Clientes</th>
                <th className="w-28 text-center whitespace-nowrap">OS Aberta</th>
                <th className="w-24 text-center whitespace-nowrap">Migrado</th>
                <th className="w-36 text-center whitespace-nowrap">Progresso</th>
                <th className="w-24 text-center whitespace-nowrap">Exceções</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-[#8A8899]">
                    Nenhuma onda cadastrada ou encontrada com o filtro aplicado.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => {
                  const statusColors: Record<string, string> = {
                    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    NEGOTIATION: 'bg-blue-50 text-blue-700 border-blue-200',
                    PAUSED: 'bg-amber-50 text-amber-700 border-amber-200',
                    COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200',
                    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
                    ARCHIVED: 'bg-rose-50 text-rose-700 border-rose-200',
                  };
                  const statusLabels: Record<string, string> = {
                    ACTIVE: 'Em Andamento',
                    NEGOTIATION: 'Em Negociação',
                    PAUSED: 'Pausado',
                    COMPLETED: 'Concluído',
                    CANCELLED: 'Cancelado',
                    ARCHIVED: 'Cancelado',
                  };

                  return (
                    <tr key={item.maId} className="hover:bg-[#F8F7FC] transition-colors">
                      <td className="font-semibold text-[#2E2D39]">{item.maName}</td>
                      <td className="text-center whitespace-nowrap">
                        <span className="font-mono text-xs px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-bold">
                          {item.uf}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap inline-flex items-center ${
                            statusColors[item.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {statusLabels[item.status] || item.status}
                        </span>
                      </td>
                      <td className="text-center font-medium whitespace-nowrap">
                        {(item.totalCustomers || 0).toLocaleString('pt-BR')}
                      </td>
                      <td className="text-center text-amber-700 font-semibold whitespace-nowrap">
                        {((item.totalOsOpen ?? item.totalOsCreated) || 0).toLocaleString('pt-BR')}
                      </td>
                      <td className="text-center font-bold text-emerald-800 whitespace-nowrap">
                        {(item.totalMigrated || 0).toLocaleString('pt-BR')}
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, item.migrationPercentage || 0)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-slate-600 w-8 text-right">
                            {item.migrationPercentage || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="text-center text-rose-600 font-semibold whitespace-nowrap">
                        {(item.totalExceptions || 0).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
