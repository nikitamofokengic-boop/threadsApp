import React from 'react';
import { AlertTriangle, RotateCcw, Trash2, Info, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  subMessage?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  icon?: 'trash' | 'reset' | 'alert' | 'info';
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  subMessage,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  icon = 'reset',
  onConfirm,
  onClose
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (icon) {
      case 'trash':
        return <Trash2 className="w-6 h-6 text-rose-600" />;
      case 'reset':
        return <RotateCcw className="w-6 h-6 text-pink-600" />;
      case 'alert':
        return <AlertTriangle className="w-6 h-6 text-amber-600" />;
      case 'info':
      default:
        return <Info className="w-6 h-6 text-pink-600" />;
    }
  };

  const getConfirmButtonClasses = () => {
    switch (confirmVariant) {
      case 'danger':
        return 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-md shadow-rose-200';
      case 'warning':
        return 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-200';
      case 'primary':
      default:
        return 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white shadow-md shadow-pink-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl border border-pink-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-pink-50 border border-pink-100 rounded-2xl shrink-0">
              {getIcon()}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Action confirmation required
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message body */}
        <div className="px-6 py-2 space-y-2">
          <p className="text-xs font-semibold text-slate-700 leading-relaxed whitespace-pre-line">
            {message}
          </p>
          {subMessage && (
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed whitespace-pre-line bg-slate-50 p-3 rounded-xl border border-slate-200">
              {subMessage}
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-6 pt-4 bg-slate-50 border-t border-pink-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-2 hover:scale-[1.02] ${getConfirmButtonClasses()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
