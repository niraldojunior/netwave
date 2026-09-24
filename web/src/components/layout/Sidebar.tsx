import React from 'react';
import {
  LayoutDashboard,
  Settings,
  Activity,
  UploadCloud,
  Filter,
  FileSpreadsheet,
  CalendarDays,
  UserCheck,
  HardHat,
} from 'lucide-react';

export type NavItemKey =
  | 'overview'
  | 'setup'
  | 'pipeline'
  | 'import'
  | 'triagem'
  | 'orders'
  | 'scheduling'
  | 'technicians'
  | 'field-migration';

interface SidebarProps {
  activeTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
}

export default function Sidebar({ activeTab, onSelectTab }: SidebarProps) {
  const navSections = [
    {
      title: 'ESTRATÉGICO',
      items: [
        { key: 'overview' as NavItemKey, label: 'Visão Geral', icon: LayoutDashboard },
        { key: 'setup' as NavItemKey, label: 'Setup', icon: Settings },
      ],
    },
    {
      title: 'OPERACIONAL',
      items: [
        { key: 'pipeline' as NavItemKey, label: 'Gestão de Esteira', icon: Activity },
        { key: 'import' as NavItemKey, label: 'Importação', icon: UploadCloud },
        { key: 'triagem' as NavItemKey, label: 'Qualificação', icon: Filter },
        { key: 'orders' as NavItemKey, label: 'Ordens', icon: FileSpreadsheet },
        { key: 'technicians' as NavItemKey, label: 'Gestão de Técnicos', icon: UserCheck },
        { key: 'scheduling' as NavItemKey, label: 'Programação', icon: CalendarDays },
        { key: 'field-migration' as NavItemKey, label: 'Atividades em Campo', icon: HardHat },
      ],
    },
  ];

  return (
    <aside className="w-[202px] bg-[#24232D] border-r border-[#343343] flex flex-col shrink-0 select-none overflow-y-auto">
      <nav className="p-2 space-y-4">
        {navSections.map((section) => (
          <div key={section.title}>
            <div className="px-2 pb-1.5 text-[10.5px] font-bold text-[#8A8899] uppercase tracking-wider">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => onSelectTab(item.key)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-[#FFD919] text-[#181919] font-bold shadow-sm'
                        : 'text-[#C5C4D4] hover:bg-[#323140] hover:text-white'
                    }`}
                  >
                    <Icon
                      size={15}
                      className={isActive ? 'text-[#181919]' : 'text-[#8A8899]'}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
