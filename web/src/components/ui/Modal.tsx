import React, { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: number;
}

export default function Modal({
  title,
  children,
  footer,
  onClose,
  width = 540,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={panelRef}
        className="bg-white rounded-lg border border-[#E8E8EE] shadow-2xl overflow-hidden outline-none flex flex-col max-h-[90vh]"
        style={{ width, maxWidth: '100%' }}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8EE]">
            <h3 className="text-base font-semibold text-[#2E2D39]">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-[#8A8899] hover:text-[#2E2D39] p-1 rounded hover:bg-[#F5F5F8] transition-colors"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-[#E8E8EE] bg-[#FAFAFB]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
