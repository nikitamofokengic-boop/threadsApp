import React, { useState, useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';

interface EditableCellProps {
  value: string | number;
  onSave: (val: any) => void;
  type?: 'text' | 'number';
  isEditable: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
  placeholder?: string;
}

export default function EditableCell({
  value,
  onSave,
  type = 'text',
  isEditable,
  min = 0,
  max,
  step = 1,
  className = '',
  suffix = '',
  prefix = '',
  placeholder = ''
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState<string>(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (!isEditable) {
    return (
      <span className={`inline-block py-1 text-slate-700 ${className}`}>
        {prefix}{typeof value === 'number' && type === 'number' ? value.toLocaleString('en-ZA', { maximumFractionDigits: 2 }) : value}{suffix}
      </span>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitValue();
    } else if (e.key === 'Escape') {
      setEditing(false);
      setInputValue(String(value));
    }
  };

  const commitValue = () => {
    setEditing(false);
    if (inputValue.trim() === '') {
      setInputValue(String(value));
      return;
    }

    if (type === 'number') {
      let num = parseFloat(inputValue);
      if (isNaN(num)) {
        setInputValue(String(value));
        return;
      }
      if (min !== undefined && num < min) num = min;
      if (max !== undefined && num > max) num = max;
      onSave(num);
    } else {
      onSave(inputValue.trim());
    }
  };

  if (editing) {
    return (
      <div className="inline-flex items-center">
        {prefix && <span className="mr-1 text-xs text-slate-400 font-mono">{prefix}</span>}
        <input
          ref={inputRef}
          type={type}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitValue}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className="px-2 py-0.5 border-2 border-indigo-500 rounded-lg bg-white text-slate-900 font-mono text-xs w-24 focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-xs"
        />
        {suffix && <span className="ml-1 text-xs text-slate-500 font-mono">{suffix}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Click to edit"
      className={`group/cell inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-indigo-200/80 hover:border-indigo-400 hover:bg-indigo-50/70 text-left transition cursor-pointer ${className}`}
    >
      <span className="text-slate-800 font-semibold">
        {prefix}{type === 'number' ? Number(value).toLocaleString('en-ZA', { maximumFractionDigits: 2 }) : value}{suffix}
      </span>
      <Pencil className="w-3 h-3 text-indigo-400 opacity-40 group-hover/cell:opacity-100 transition-opacity" />
    </button>
  );
}
