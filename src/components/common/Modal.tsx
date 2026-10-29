import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  onSubmit?: (e: React.FormEvent) => void;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  onSubmit,
}) => {
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Focus preservation and body scroll lock
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Prevent background scrolling
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Focus modal container
      if (modalContainerRef.current) {
        modalContainerRef.current.focus();
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
        if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  };

  const ContentWrapper = onSubmit ? 'form' : 'div';
  const wrapperProps = onSubmit
    ? { onSubmit, className: 'flex flex-col flex-1 min-h-0' }
    : { className: 'flex flex-col flex-1 min-h-0' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Window */}
      <div
        ref={modalContainerRef}
        tabIndex={-1}
        className={`relative w-full ${maxWidths[maxWidth]} flex flex-col max-h-[min(92dvh,920px)] bg-[#0c0c12] border border-red-950/50 rounded-2xl shadow-2xl shadow-black/80 z-10 animate-in fade-in zoom-in-95 duration-150 outline-none overflow-hidden`}
      >
        {/* Header - Fixed & Always Visible */}
        <div className="flex shrink-0 items-start justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/[0.08] bg-[#0c0c12]">
          <div className="pr-4">
            <h3 id="modal-title" className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>{title}</span>
            </h3>
            {description && (
              <p className="mt-0.5 text-xs text-slate-400">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors shrink-0"
            title="Close (Esc)"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Wrapper (Form or Div) */}
        <ContentWrapper {...(wrapperProps as any)}>
          {/* Body - Independently Scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            {children}
          </div>

          {/* Footer - Fixed, Permanently Visible */}
          {footer && (
            <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-white/[0.08] bg-[#08080c]">
              {footer}
            </div>
          )}
        </ContentWrapper>
      </div>
    </div>
  );
};

