import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Download,
  ExternalLink,
  Trash2,
  Eye,
  X,
  FileCheck
} from 'lucide-react';
import { PaymentProof } from '../../types';
import { Button } from './Button';
import { Modal } from './Modal';

interface PaymentProofViewerProps {
  paymentId: string;
  proofs: PaymentProof[];
  allowDelete?: boolean;
  onDeleteProof?: (fileId: string) => Promise<void>;
  title?: string;
}

export const PaymentProofViewer: React.FC<PaymentProofViewerProps> = ({
  paymentId,
  proofs = [],
  allowDelete = false,
  onDeleteProof,
  title = 'Payment Proof & Evidence'
}) => {
  const [selectedProof, setSelectedProof] = useState<PaymentProof | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!proofs || proofs.length === 0) {
    return null;
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileUrl = (fileId: string, download = false) => {
    return `/api/payments/${paymentId}/proofs/${fileId}${download ? '?download=1' : ''}`;
  };

  const handleDelete = async (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDeleteProof) return;
    if (!window.confirm('Are you sure you want to remove this payment proof attachment?')) return;

    setDeletingId(fileId);
    try {
      await onDeleteProof(fileId);
      if (selectedProof && (selectedProof.fileId === fileId || selectedProof._id === fileId)) {
        setSelectedProof(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <FileCheck className="w-4 h-4 text-emerald-600" />
        <span>{title} ({proofs.length})</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {proofs.map((proof) => {
          const isPdf = proof.mimeType === 'application/pdf' || proof.originalName.toLowerCase().endsWith('.pdf');
          const fileId = proof.fileId || proof._id || '';

          return (
            <div
              key={fileId}
              className="border border-slate-200 hover:border-emerald-300 rounded-xl p-2.5 bg-white transition-all shadow-2xs group relative flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    {isPdf ? <FileText className="w-4 h-4 text-rose-600" /> : <ImageIcon className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate" title={proof.originalName}>
                      {proof.originalName}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatFileSize(proof.size)} • {isPdf ? 'PDF Receipt' : 'Image Proof'}
                    </p>
                  </div>
                </div>

                {/* Inline Thumbnail for images */}
                {!isPdf && (
                  <div
                    onClick={() => setSelectedProof(proof)}
                    className="mt-2 h-24 w-full rounded-lg overflow-hidden bg-slate-50 border border-slate-100 cursor-pointer flex items-center justify-center relative group"
                  >
                    <img
                      src={getFileUrl(fileId)}
                      alt={proof.originalName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1">
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-1 mt-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1">
                  <a
                    href={getFileUrl(fileId)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1 p-1 hover:bg-emerald-50 rounded"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-3 h-3" /> View
                  </a>
                  <a
                    href={getFileUrl(fileId, true)}
                    download={proof.originalName}
                    className="text-[11px] text-slate-600 hover:text-slate-800 font-medium flex items-center gap-1 p-1 hover:bg-slate-100 rounded"
                    title="Download evidence"
                  >
                    <Download className="w-3 h-3" /> Download
                  </a>
                </div>

                {allowDelete && onDeleteProof && (
                  <button
                    type="button"
                    onClick={(e) => handleDelete(fileId, e)}
                    disabled={deletingId === fileId}
                    className="text-[11px] text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded transition-colors disabled:opacity-50"
                    title="Delete proof"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox / Preview Modal for expanded viewing */}
      {selectedProof && (
        <Modal
          isOpen={Boolean(selectedProof)}
          onClose={() => setSelectedProof(null)}
          title={selectedProof.originalName}
          subtitle={`Size: ${formatFileSize(selectedProof.size)} • Verified Payment Evidence`}
        >
          <div className="space-y-4">
            <div className="max-h-[65vh] overflow-auto rounded-xl bg-slate-900/5 flex items-center justify-center p-2 border border-slate-200">
              <img
                src={getFileUrl(selectedProof.fileId || selectedProof._id || '')}
                alt={selectedProof.originalName}
                className="max-h-[60vh] max-w-full object-contain rounded-lg shadow"
              />
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-mono text-[11px]">
                ID: {selectedProof.fileId || selectedProof._id}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={getFileUrl(selectedProof.fileId || selectedProof._id || '', true)}
                  download={selectedProof.originalName}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download Full Resolution
                </a>
                <Button size="sm" variant="ghost" onClick={() => setSelectedProof(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
