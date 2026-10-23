import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from './Button';
import { Card } from './Card';
import { Modal } from './Modal';

export const AccountDeletionSection: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { success, error: toastError } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const closeDialog = () => {
    if (isDeleting) return;
    setIsOpen(false);
    setPassword('');
    setConfirmation('');
  };

  const handleDelete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (confirmation !== 'DELETE' || isDeleting) return;

    setIsDeleting(true);
    try {
      const response = await api.delete('/auth/account', {
        data: { password, confirmation }
      });
      logout();
      success(response.data?.message || 'Your account has been deleted successfully.');
      navigate('/', { replace: true });
    } catch (err: any) {
      toastError(err.message || 'Account deletion failed. Your account remains active.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="border-rose-200 bg-rose-50/40 p-5 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-rose-950">Delete Your Profile</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Permanently remove your profile and sign-in access. Completed work and payment or dispute records are retained with identifying account details removed.
          </p>
        </div>
        <Button
          type="button"
          variant="danger"
          size="sm"
          leftIcon={<Trash2 className="h-3.5 w-3.5" />}
          onClick={() => setIsOpen(true)}
          className="w-full sm:w-auto"
        >
          Delete Your Profile
        </Button>
      </Card>

      <Modal
        isOpen={isOpen}
        onClose={closeDialog}
        title="Delete your WorkMatch account?"
        subtitle="This action cannot be undone."
      >
        <form onSubmit={handleDelete} className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-950">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <p>
              Your profile, saved jobs, verification documents, and inbox notifications will be removed. Your employer&apos;s unfinished job postings will be closed. Deletion is blocked while you have confirmed or in-progress shifts.
            </p>
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            Applications, completed assignments, payment history, reviews, reports, job-change history, and audit records may remain for marketplace history and dispute handling. Your account identity on retained records will be anonymized.
          </p>

          <div>
            <label htmlFor="delete-account-password" className="mb-1.5 block text-xs font-medium text-slate-700">
              Current password
            </label>
            <input
              id="delete-account-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>

          <div>
            <label htmlFor="delete-account-confirmation" className="mb-1.5 block text-xs font-medium text-slate-700">
              Type DELETE to confirm
            </label>
            <input
              id="delete-account-confirmation"
              type="text"
              autoComplete="off"
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeDialog} disabled={isDeleting} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              isLoading={isDeleting}
              disabled={confirmation !== 'DELETE' || !password}
              className="w-full sm:w-auto"
            >
              Confirm Delete
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};