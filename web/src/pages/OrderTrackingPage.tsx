import React, { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import DataTable, { type DataTableColumn } from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import { MigrationApi } from '../services/api';
import type { MigrationItem } from '../types';
import { Search, RefreshCw } from 'lucide-react';

export default function OrderTrackingPage({ maId }: { maId?: string }) {
  const [items, setItems] = useState<MigrationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await MigrationApi.listItems({
        maId,
        status: statusFilter || undefined,
        search: search || undefined,
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
  }, [maId, statusFilter, page]);

  const columns: DataTableColumn<MigrationItem>[] = [
    {
      key: 'customer',
      header: 'Cliente / CRM ID',
      render: (r) => (
        <div>
          <div className="font-semibold text-xs text-[#2E2D39]">{r.customerName}</div>
          <div className="text-[11px] font-mono text-[#8A8899]">{r.customerId}</div>
        </div>
      ),
    },
    {
      key: 'os',
      header: 'OS NIO',
      render: (r) =>
        r.osId ? (
          <span className="font-mono text-xs font-bold text-[#2E2D39]">{r.osId}</span>
        ) : (
          <span className="text-[#8A8899] text-xs">Pendente</span>
        ),
    },
    {
      key: 'sa',
      header: 'SA',
      render: (r) =>
        r.saId ? (
          <span className="font-mono text-xs font-semibold text-[#514F66]">{r.saId}</span>
        ) : (
          <span className="text-[#8A8899] text-xs">Pendente</span>
        ),
    },
    {
      key: 'serial',
      header: 'Serial ONT',
      render: (r) => (
        <div>
          <span className="font-mono text-xs font-semibold text-[#2E2D39]">{r.ontSerialEffective}</span>
          {r.ontSerialEffective !== r.ontSerialOriginal && (
            <div className="text-[10px] text-amber-600 font-medium">Corrigido em campo</div>
          )}
        </div>
      ),
    },
    {
      key: 'cdo',
      header: 'CDO Destino',
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-[#2E2D39]">{r.targetBoxId || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusPill status={r.migrationStatus} />,
    },
    {
      key: 'wfm',
      header: 'Técnico / Agendamento',
      render: (r) =>
        r.technicianId ? (
          <div>
            <div className="text-xs font-semibold text-[#2E2D39]">{r.technicianId}</div>
            <div className="text-[10px] text-[#8A8899]">{r.scheduledDate || 'Em campo'}</div>
          </div>
        ) : (
          <span className="text-[11px] text-[#8A8899]">Aguardando Programação</span>
        ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[#2E2D39]">Gestão de Esteira de OSs e SAs</h1>
        <p className="text-xs text-[#8A8899]">
          Rastreabilidade ponta a ponta da correlação: Cliente ↔ MigrationItem ↔ OS ↔ SA ↔ ONT ↔ CDO ↔ Técnico
        </p>
      </div>

      {/* Filter bar */}
      <div className="p-4 bg-white border border-[#E8E8EE] rounded-lg flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-[#8A8899]" />
          <input
            type="text"
            placeholder="Buscar por cliente, OS, SA, CDO ou serial..."
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
            <option value="OS_CREATED">A Programar</option>
            <option value="SCHEDULED">Programado</option>
            <option value="IN_FIELD">Em Campo</option>
            <option value="MIGRATED">Migrado OK</option>
            <option value="MIGRATION_FAILED">Falha Cutover</option>
            <option value="ROLLED_BACK">Revertido (Rollback)</option>
          </select>

          <Button variant="outline" size="sm" onClick={() => fetchItems()}>
            <RefreshCw size={12} /> Atualizar
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
        emptyMessage="Nenhuma ordem encontrada."
      />
    </div>
  );
}
