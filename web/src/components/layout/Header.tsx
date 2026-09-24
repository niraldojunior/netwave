import React from 'react';
import { Waves, Building2 } from 'lucide-react';
import type { Ma } from '../../types';

interface HeaderProps {
  mas: Ma[];
  activeMaId?: string;
  onMaChange: (id: string) => void;
}

export default function Header({
  mas,
  activeMaId,
  onMaChange,
}: HeaderProps) {
  const activeMas = mas.filter((m) => m.status === 'ACTIVE');

  return (
    <header className="h-14 bg-white border-b border-[#E8E8EE] px-6 flex items-center justify-between z-30 shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded bg-[#FFD919] text-[#181919] shadow-sm">
          <Waves size={18} strokeWidth={2.5} />
        </div>
        <div className="flex items-baseline gap-3">
          <h1 className="font-['Montserrat',sans-serif] font-bold text-2xl text-[#2E2D39] tracking-tight leading-none">
            netWave
          </h1>
          <span className="text-sm text-[#737182] font-medium leading-none">
            Orquestrador de Migração Física de Acesso
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* M&A Switcher */}
        <div className="flex items-center gap-2">
          <label htmlFor="ma-select" className="text-xs text-[#514F66] font-medium flex items-center gap-1.5 whitespace-nowrap">
            <Building2 size={14} className="text-[#FFD919]" />
            Onda de Migração:
          </label>
          <select
            id="ma-select"
            value={activeMaId || ''}
            onChange={(e) => onMaChange(e.target.value)}
            className="text-xs font-semibold bg-[#FAFAFB] border border-[#E8E8EE] rounded px-3 py-1.5 text-[#2E2D39] outline-none focus:border-[#FFD919]"
          >
            {activeMas.length === 0 ? (
              <option value="">Nenhuma onda em andamento</option>
            ) : (
              activeMas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.uf})
                </option>
              ))
            )}
          </select>
        </div>

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#E8E8EE]">
          <div className="w-7 h-7 rounded-full bg-[#2E2D39] text-white flex items-center justify-center text-xs font-bold">
            OP
          </div>
          <div className="hidden md:block">
            <div className="text-xs font-semibold text-[#2E2D39] leading-tight">Operador V.tal</div>
            <div className="text-[10px] text-[#8A8899]">NOC / Fulfillment</div>
          </div>
        </div>
      </div>
    </header>
  );
}
