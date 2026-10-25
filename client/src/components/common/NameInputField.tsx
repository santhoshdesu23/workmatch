import React from 'react';
import { MAX_NAME_LENGTH, sanitizePastedName } from '../../utils/nameValidation';

export interface NameInputFieldProps {
  id: string;
  name?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  maxLength?: number;
  icon?: React.ReactNode;
  className?: string;
}

export const NameInputField: React.FC<NameInputFieldProps> = ({
  id,
  name,
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  required = false,
  disabled = false,
  autoComplete,
  maxLength = MAX_NAME_LENGTH,
  icon,
  className = ''
}) => {
  const currentLength = value ? value.length : 0;
  const isAtLimit = currentLength >= maxLength;
  const counterId = `${id}-counter`;
  const errorId = `${id}-error`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Always restrict value safely to maxLength
    const safeValue = sanitizePastedName(raw, maxLength);
    onChange(safeValue);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const input = e.currentTarget;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;

    const newValue = value.slice(0, start) + pastedText + value.slice(end);
    const safeValue = sanitizePastedName(newValue, maxLength);
    onChange(safeValue);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Label & Real-Time Character Counter Header */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-700 select-none cursor-pointer"
        >
          {label} {required && <span className="text-emerald-700">*</span>}
        </label>
        <span
          id={counterId}
          aria-live="polite"
          className={`text-[11px] font-mono tabular-nums transition-colors ${
            isAtLimit ? 'text-amber-600 font-bold' : 'text-slate-400'
          }`}
          title={`${currentLength} of ${maxLength} characters used`}
        >
          {currentLength}/{maxLength}
        </span>
      </div>

      {/* Input container */}
      <div className="relative">
        {icon && (
          <div className="absolute left-3.5 top-3 pointer-events-none flex items-center">
            {icon}
          </div>
        )}
        <input
          id={id}
          name={name || id}
          type="text"
          value={value}
          maxLength={maxLength}
          onChange={handleChange}
          onPaste={handlePaste}
          onBlur={onBlur}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${errorId} ${counterId}` : counterId}
          className={`w-full text-xs py-2.5 rounded-xl border transition-all focus:outline-none ${
            icon ? 'pl-10 pr-3.5' : 'px-3.5'
          } ${
            error
              ? 'border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-rose-50/20 text-slate-900'
              : 'border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white text-slate-900'
          } ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
        />
      </div>

      {/* Inline Validation Feedback */}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-rose-600 font-medium flex items-center gap-1.5 pt-0.5 animate-fadeIn"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
