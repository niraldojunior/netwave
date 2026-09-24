import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataTable, { type DataTableColumn } from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { MigrationApi } from '../services/api';
import type { BoxSchedule, MigrationItem, Technician } from '../types';
import { Search, Calendar, User, RefreshCw, Edit3, XCircle, Users, CheckCircle } from 'lucide-react';

export default function FieldSchedulePage({ maId }: { maId?: string }) {
  const [schedules, setSchedules] = useState<BoxSchedule[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locationOptions, setLocationOptions] = useState<{ value: string; label: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [selectedBox, setSelectedBox] = useState<BoxSchedule | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [selectedTechId, setSelectedTechId] = useState('');
  const [saving, setSaving] = useState(false);

  // Customer List Modal
  const [viewBoxItems, setViewBoxItems] = useState<BoxSchedule | null>(null);
  const [boxItems, setBoxItems] = useState<MigrationItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const parseLocationFilter = (val: string) => {
    if (!val) return { municipality: undefined, neighborhood: undefined };
    if (val.startsWith('muni:')) {
      return { municipality: val.substring(5), neighborhood: undefined };
    }
    if (val.startsWith('loc:')) {
      const parts = val.substring(4).split('||');
      return { municipality: parts[0] || undefined, neighborhood: parts[1] || undefined };
    }
    return { municipality: val, neighborhood: undefined };
  };

  const loadLocations = async () => {
    if (!maId) {
      setLocationOptions([]);
      return;
    }
    try {
      const res = await MigrationApi.listBoxSchedules({ maId, limit: 1000 });
      const muniMap = new Map<string, Set<string>>();
      for (const s of res.schedules) {
        const m = (s.municipality || '').trim();
        const n = (s.neighborhood || '').trim();
        if (!m && !n) continue;
        if (!muniMap.has(m)) {
          muniMap.set(m, new Set<string>());
        }
        if (n) {
          muniMap.get(m)!.add(n);
        }
      }

      const options: { value: string; label: string }[] = [];
      const sortedMunis = Array.from(muniMap.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));

      for (const m of sortedMunis) {
        const neighs = Array.from(muniMap.get(m)!).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        if (neighs.length > 1) {
          options.push({ value: `muni:${m}`, label: `${m} (Todos os bairros)` });
          for (const n of neighs) {
            options.push({ value: `loc:${m}||${n}`, label: `${m} - ${n}` });
          }
        } else if (neighs.length === 1) {
          options.push({ value: `loc:${m}||${neighs[0]}`, label: `${m} - ${neighs[0]}` });
        } else {
          options.push({ value: `muni:${m}`, label: m });
        }
      }

      setLocationOptions(options);
    } catch (err) {
      console.error('Falha ao buscar locais de CDO', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const loc = parseLocationFilter(selectedLocation);
      const data = await MigrationApi.listBoxSchedules({
        maId,
        search: search || undefined,
        municipality: loc.municipality,
        neighborhood: loc.neighborhood,
        status: statusFilter || undefined,
        limit: 50,
      });
      setSchedules(data.schedules);
      setTotal(data.total);

      if (maId) {
        const techs = await MigrationApi.listTechnicians(maId);
        setTechnicians(techs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedLocation('');
    loadLocations();
  }, [maId]);

  useEffect(() => {
    fetchData();
  }, [maId, selectedLocation, statusFilter]);

  const openScheduleModal = (box: BoxSchedule) => {
    setSelectedBox(box);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = box.scheduledDate || tomorrow.toISOString().substring(0, 10);
    setScheduledDate(dateStr);
    const activeTechs = technicians.filter((t) => t.status === 'ACTIVE');
    const isCurrentActive = box.technicianId && activeTechs.some((t) => t.id === box.technicianId);
    setSelectedTechId(isCurrentActive ? box.technicianId! : activeTechs[0]?.id || '');
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBox || !maId) return;

    const chosenTech = technicians.find((t) => t.id === selectedTechId);
    if (!chosenTech || chosenTech.status !== 'ACTIVE') {
      alert('Selecione um técnico com status ATIVO para realizar a programação.');
      return;
    }

    setSaving(true);
    try {
      await MigrationApi.scheduleBox({
        maId,
        targetBoxId: selectedBox.targetBoxId,
        scheduledDate,
        technicianId: selectedTechId,
      });
      setSelectedBox(null);
      await fetchData();
      alert(`Programação da CDO ${selectedBox.targetBoxId} salva com sucesso!`);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSchedule = async (box: BoxSchedule) => {
    if (confirm(`Tem certeza que deseja cancelar o agendamento da CDO "${box.targetBoxId}"? As ordens associadas retornarão para o status "OS Criada".`)) {
      try {
        await MigrationApi.cancelBoxSchedule(box.id);
        await fetchData();
        alert(`Agendamento da CDO ${box.targetBoxId} cancelado com sucesso.`);
      } catch (err: any) {
        alert(`Erro ao cancelar agendamento: ${err.message}`);
      }
    }
  };

  const handleOpenBoxItems = async (box: BoxSchedule) => {
    setViewBoxItems(box);
    setLoadingItems(true);
    try {
      const res = await MigrationApi.listItems({ maId, targetBoxId: box.targetBoxId, limit: 100 });
      setBoxItems(res.items);
    } catch (err) {
      console.error('Falha ao buscar itens da CDO', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const columns: DataTableColumn<BoxSchedule>[] = [
    {
      key: 'box',
      header: 'CDO',
      render: (r) => (
        <span className="font-mono font-bold text-xs text-[#2E2D39] bg-[#F5F5F8] px-2 py-1 rounded border border-[#E8E8EE] whitespace-nowrap inline-block">
          {r.targetBoxId}
        </span>
      ),
      cellClassName: 'whitespace-nowrap',
      headerClassName: 'whitespace-nowrap',
    },
    {
      key: 'location',
      header: 'Local',
      render: (r) => (
        <div>
          <div className="font-semibold text-xs text-[#2E2D39]">{r.municipality}</div>
          <div className="text-[11px] text-[#8A8899]">{r.neighborhood}</div>
        </div>
      ),
    },
    {
      key: 'counts',
      header: "HC's",
      render: (r) => (
        <button
          onClick={() => handleOpenBoxItems(r)}
          className="text-xs font-semibold text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
          title="Ver clientes desta CDO"
        >
          <Users size={12} />
          {r.totalCustomers} HC's
        </button>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusPill status={r.scheduleStatus} />,
    },
    {
      key: 'date',
      header: 'Data',
      render: (r) =>
        r.scheduledDate ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#2E2D39] whitespace-nowrap">
            <Calendar size={13} className="text-[#8A8899]" />
            <span>{r.scheduledDate}</span>
          </div>
        ) : (
          <span className="text-xs text-[#8A8899]">-</span>
        ),
    },
    {
      key: 'tech',
      header: 'Técnico',
      render: (r) =>
        r.technicianName || r.technicianId ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#2E2D39] whitespace-nowrap">
            <User size={13} className="text-[#10B981]" />
            <span>{r.technicianName || r.technicianId}</span>
          </div>
        ) : (
          <span className="text-xs text-[#8A8899]">-</span>
        ),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant={r.scheduleStatus === 'SCHEDULED' ? 'outline' : 'primary'}
            size="sm"
            onClick={() => openScheduleModal(r)}
          >
            {r.scheduleStatus === 'SCHEDULED' ? (
              <>
                <Edit3 size={12} className="mr-1" /> Reagendar
              </>
            ) : (
              <>
                <Calendar size={12} className="mr-1" /> Agendar
              </>
            )}
          </Button>

          {r.scheduleStatus === 'SCHEDULED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCancelSchedule(r)}
              className="text-rose-600 border-rose-200 hover:bg-rose-50"
              title="Cancelar agendamento da CDO"
            >
              <XCircle size={12} className="mr-1" />
              Cancelar
            </Button>
          )}
        </div>
      ),
      cellClassName: 'text-right',
      headerClassName: 'text-right',
    },
  ];

  if (!maId) {
    return (
      <div className="p-8 text-center text-[#8A8899]">
        Selecione um M&A no topo para visualizar as CDOs disponíveis para programação.
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
            <h1 className="text-xl font-bold text-[#2E2D39]">Programação de Campo por CDO</h1>
          </div>
          <p className="text-xs text-[#8A8899] mt-1">
            Planejamento geográfico centrado em caixas ópticas (CDO): agendamento em lote, reagendamento e cancelamento
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white border border-[#E8E8EE] rounded-lg flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-[#8A8899]" />
          <input
            type="text"
            placeholder="Buscar por código de CDO, município ou bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            className="text-xs w-full outline-none bg-transparent"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="text-xs bg-[#FAFAFB] border border-[#E8E8EE] rounded px-2.5 py-1.5 text-[#514F66] outline-none max-w-[220px]"
            title="Filtrar por Local (Município / Bairro)"
          >
            <option value="">Todos os Locais</option>
            {locationOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-[#FAFAFB] border border-[#E8E8EE] rounded px-2.5 py-1.5 text-[#514F66] outline-none"
          >
            <option value="">Todos os Status</option>
            <option value="AVAILABLE">Disponível</option>
            <option value="SCHEDULED">Programado</option>
            <option value="COMPLETED">Concluída</option>
          </select>

          <Button variant="outline" size="sm" onClick={() => fetchData()}>
            <RefreshCw size={12} /> Filtrar
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <Card
        title="Quadro de Caixas (CDO)"
        subtitle={`Total de ${total} caixas encontradas`}
        noPadding
      >
        <DataTable
          columns={columns}
          rows={schedules}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage="Nenhuma CDO disponível para programação nos filtros atuais."
        />
      </Card>

      {/* Schedule / Reschedule Modal */}
      {selectedBox && (
        <Modal
          title={
            selectedBox.scheduleStatus === 'SCHEDULED'
              ? `Reagendar CDO ${selectedBox.targetBoxId}`
              : `Agendar CDO ${selectedBox.targetBoxId}`
          }
          onClose={() => setSelectedBox(null)}
        >
          <form onSubmit={handleSaveSchedule} className="space-y-4">
            <div className="p-3 bg-[#FAFAFB] border border-[#E8E8EE] rounded space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8A8899]">CDO:</span>
                <span className="font-semibold text-[#2E2D39] font-mono">
                  {selectedBox.targetBoxId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8A8899]">Localidade:</span>
                <span className="text-[#514F66]">
                  {selectedBox.municipality} - {selectedBox.neighborhood}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8A8899]">Volume:</span>
                <span className="font-semibold text-[#10B981]">
                  {selectedBox.totalCustomers} clientes / {selectedBox.totalOrders} OSs
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#514F66] mb-1">
                Data Prevista para Execução
              </label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#514F66] mb-1">
                Técnico de Campo Designado
              </label>
              <select
                required
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              >
                <option value="">Selecione o técnico de campo...</option>
                {technicians
                  .filter((t) => t.status === 'ACTIVE')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.vendorCompany} · Matrícula: {t.externalTechId})
                    </option>
                  ))}
              </select>
            </div>

            {selectedBox.scheduleStatus === 'SCHEDULED' && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                O reagendamento registrará histórico auditável em <code className="font-mono">NW_BOX_SCHEDULE_HISTORY</code>.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setSelectedBox(null)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" loading={saving}>
                Confirmar Agendamento
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal View Customers in Box */}
      {viewBoxItems && (
        <Modal
          title={`Clientes e Ordens da CDO ${viewBoxItems.targetBoxId}`}
          width={702}
          onClose={() => setViewBoxItems(null)}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2 rounded border">
              <span>Localidade: <strong>{viewBoxItems.municipality} - {viewBoxItems.neighborhood}</strong></span>
              <span>Total: <strong>{boxItems.length} clientes</strong></span>
            </div>

            <div className="max-h-96 overflow-y-auto border border-[#E9E8F2] rounded">
              <table className="vt-table w-full text-xs">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap">Cliente</th>
                    <th className="whitespace-nowrap">Endereço</th>
                    <th className="whitespace-nowrap">OS / SA</th>
                    <th className="whitespace-nowrap">Serial ONT</th>
                    <th className="whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingItems ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-500">
                        Carregando ordens da CDO...
                      </td>
                    </tr>
                  ) : boxItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-500">
                        Nenhuma ordem encontrada para esta CDO.
                      </td>
                    </tr>
                  ) : (
                    boxItems.map((item) => (
                      <tr key={item.id}>
                        <td className="whitespace-nowrap">
                          <div className="font-semibold text-xs text-[#2E2D39]">{item.customerName}</div>
                          <div className="font-mono text-[10px] text-slate-500">{item.externalCustomerId}</div>
                        </td>
                        <td className="whitespace-nowrap max-w-sm truncate text-xs text-[#514F66]" title={item.rawAddress}>
                          {item.rawAddress}
                        </td>
                        <td className="whitespace-nowrap">
                          <div className="font-mono text-xs font-bold text-blue-700">{item.osId || '-'}</div>
                          <div className="font-mono text-[10px] text-slate-500">{item.saId || '-'}</div>
                        </td>
                        <td className="font-mono text-xs whitespace-nowrap">{item.ontSerialEffective}</td>
                        <td className="whitespace-nowrap">
                          <StatusPill status={item.migrationStatus} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setViewBoxItems(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
