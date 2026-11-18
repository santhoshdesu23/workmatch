import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  X,
  AlertCircle,
  CheckCircle2,
  FileCheck
} from 'lucide-react';

interface PaymentProofUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  existingCount?: number;
  isUploading?: boolean;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf'];
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];

export const PaymentProofUploader: React.FC<PaymentProofUploaderProps> = ({
  files,
  onFilesChange,
  maxFiles = 3,
  existingCount = 0,
  isUploading = false
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remainingSlots = Math.max(0, maxFiles - existingCount - files.length);

  const validateAndAddFiles = (incomingFiles: FileList | File[]) => {
    setErrorMessage(null);
    const validToAdd: File[] = [];

    const fileArray = Array.from(incomingFiles);

    if (fileArray.length > remainingSlots) {
      setErrorMessage(`You can only add ${remainingSlots} more file(s). Maximum ${maxFiles} total.`);
      return;
    }

    for (const file of fileArray) {
      // 1. Format check
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const isValidExt = ALLOWED_EXTENSIONS.includes(ext);
      const isValidMime = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());

      if (!isValidExt && !isValidMime) {
        setErrorMessage(`"${file.name}" is not supported. Please upload PNG, JPG, JPEG, or PDF files.`);
        return;
      }

      // 2. Size check
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(`"${file.name}" exceeds the 5 MB file size limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
        return;
      }

      // 3. Duplicate check within current selection
      const isDuplicate = files.some(
        (f) => f.name === file.name && f.size === file.size
      );
      if (isDuplicate) {
        setErrorMessage(`"${file.name}" is already in your upload queue.`);
        continue;
      }

      validToAdd.push(file);
    }

    if (validToAdd.length > 0) {
      onFilesChange([...files, ...validToAdd]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (isUploading || remainingSlots <= 0) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
    }
    // Reset input so user can pick same file again if deleted
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    const updated = files.filter((_, idx) => idx !== index);
    onFilesChange(updated);
    setErrorMessage(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-slate-800 mb-0.5">
          Upload Payment Proof
        </label>
        <p className="text-[11px] text-slate-500">
          Upload a screenshot of your successful payment or bank transfer receipt.
        </p>
      </div>

      {/* Drag & Drop Area */}
      {remainingSlots > 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-emerald-500 bg-emerald-50/50'
              : 'border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-emerald-700 hover:underline">
                Click to browse
              </span>{' '}
              <span className="text-xs text-slate-500">or drag and drop evidence files here</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Supported formats: PNG, JPG, JPEG, PDF • Up to 5 MB per file ({remainingSlots} slot{remainingSlots > 1 ? 's' : ''} remaining)
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center text-xs text-slate-500">
          Maximum of {maxFiles} payment evidence attachments reached.
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-start gap-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span className="flex-1">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pending Files Queue */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
            <span>Files ready to attach ({files.length}):</span>
            <span className="text-[10px] text-emerald-600 font-medium">Valid formats confirmed</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {files.map((file, idx) => {
              const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
              const previewUrl = !isPdf ? URL.createObjectURL(file) : null;

              return (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center gap-2 p-2 border border-slate-200 rounded-xl bg-white shadow-2xs relative"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onLoad={() => URL.revokeObjectURL(previewUrl)}
                      />
                    ) : (
                      <FileText className="w-5 h-5 text-rose-600" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatFileSize(file.size)} • {isPdf ? 'PDF Receipt' : 'Image'}
                    </p>
                  </div>

                  {!isUploading && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-100 transition-colors"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isUploading && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-xl animate-pulse">
          <FileCheck className="w-4 h-4 animate-spin text-emerald-600" />
          <span>Uploading payment evidence to MongoDB storage bucket...</span>
        </div>
      )}
    </div>
  );
};
