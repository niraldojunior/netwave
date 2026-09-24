import React, { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import DataTable, { type DataTableColumn } from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import { MigrationApi } from '../services/api';
import type { MigrationItem } from '../types';
import { Search, Play, AlertTriangle, RefreshCw } from 'lucide-react';

export default function PreparationPage({ maId }: { maId?: string }) {
  const [items, setItems] = useState<MigrationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [municipality, setMunicipality] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await MigrationApi.listItems({
        maId,
        status: statusFilter || undefined,
        search: search || undefined,
        municipality: municipality || undefined,
        limit: 25,
        offset: (page - 1) * 25,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [maId, statusFilter, municipality, page]);

  const handleRunPreparation = async () => {
    if (!maId) return alert('Selecione um M&A no topo antes de disparar a preparação.');
    setPreparing(true);
    try {
      const res = await MigrationApi.prepareItems({ maId });
      alert(
        `Pipeline concluído!\nProcessados: ${res.processed}\nProntos (Viáveis): ${res.ready}\nExceções Endereço: ${res.exceptions}\nInviáveis: ${res.notViable}`,
      );
      fetchItems();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setPreparing(false);
    }
  };

  const columns: DataTableColumn<MigrationItem>[] = [
    {
      key: 'customer',
      header: 'Cliente / ID CRM',
      render: (r) => (
        <div>
          <div className="font-semibold text-xs text-[#2E2D39]">{r.customerName}</div>
          <div className="text-[11px] font-mono text-[#8A8899]">{r.customerId}</div>
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Endereço Bruto / CEP',
      render: (r) => (
        <div>
          <div className="text-xs text-[#514F66] truncate max-w-[220px]" title={r.rawAddress}>
            {r.rawAddress}
          </div>
          <div className="text-[11px] text-[#8A8899]">
            {r.city} - {r.stateOrUf} · CEP {r.cep}
          </div>
        </div>
      ),
    },
    {
      key: 'geoMatch',
      header: 'Match Geográfico',
      render: (r) =>
        r.geographicAddressId ? (
          <div>
            <div className="font-mono text-xs text-[#10B981] font-semibold">{r.geographicAddressId}</div>
            <div className="text-[10px] text-[#8A8899]">Score: {r.addressMatchScore || '0.95'}</div>
          </div>
        ) : (
          <span className="text-[#8A8899] text-xs">-</span>
        ),
    },
    {
      key: 'viability',
      header: 'CDO Alvo / HC V.tal',
      render: (r) =>
        r.targetBoxId ? (
          <div>
            <span className="font-mono text-xs font-semibold text-[#2E2D39]">{r.targetBoxId}</span>
            <div className="text-[10px] text-[#8A8899]">{r.targetHcId}</div>
          </div>
        ) : (
          <span className="text-[#8A8899] text-xs">-</span>
        ),
    },
    {
      key: 'origin',
      header: 'Caixa Origem',
      render: (r) => (
        <div>
          <span className="font-mono text-xs text-[#514F66]">{r.originBoxId}</span>
          <div className="text-[10px] text-[#8A8899]">{r.originProvider}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status da Jornada',
      render: (r) => <StatusPill status={r.migrationStatus} />,
    },
    {
      key: 'error',
      header: 'Motivo / Diagnóstico',
      render: (r) =>
        r.errorCode ? (
          <div className="text-[11px] text-red-600 flex items-center gap-1">
            <AlertTriangle size={12} className="shrink-0" />
            <span title={r.errorDescription}>{r.errorCode}</span>
          </div>
        ) : (
          <span className="text-[#8A8899] text-xs">—</span>
        ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#2E2D39]">Higienização & Viabilidade Técnica</h1>
          <p className="text-xs text-[#8A8899]">
            Higienização de endereços, match geográfico na base V.tal e identificação da CDO/CDOI e porta destino
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={handleRunPreparation}
            loading={preparing}
          >
            <Play size={15} /> Executar Pipeline de Viabilidade
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white border border-[#E8E8EE] rounded-lg flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-[#8A8899]" />
          <input
            type="text"
            placeholder="Buscar por cliente, serial, ID ou endereço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchItems()}
            className="text-xs w-full outline-none bg-transparent"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-[#FAFAFB] border border-[#E8E8EE] rounded px-2.5 py-1.5 text-[#514F66] outline-none"
          >
            <option value="">Todos os Status</option>
            <option value="IMPORTED">Importado</option>
            <option value="PREPARING">Preparando</option>
            <option value="READY">Pronto (Viável)</option>
            <option value="ADDRESS_EXCEPTION">Exceção Endereço</option>
            <option value="NOT_VIABLE">Inviável</option>
          </select>

          <Button variant="outline" size="sm" onClick={() => fetchItems()}>
            <RefreshCw size={12} /> Filtrar
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        rows={items}
        rowKey={(r) => r.id}
        loading={loading}
        total={total}
        page={page}
        pageSize={25}
        onPageChange={(p) => setPage(p)}
        emptyMessage="Nenhum cliente encontrado nos filtros selecionados."
      />
    </div>
  );
}
