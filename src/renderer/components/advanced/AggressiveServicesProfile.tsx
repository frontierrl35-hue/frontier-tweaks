import { useState } from 'react';
import { AlertOctagon } from 'lucide-react';
import { Button } from '../buttons/Button';
import { ConfirmationDialog } from '../dialogs/ConfirmationDialog';

const BREAKS = [
  'Windows Update',
  'Microsoft Store',
  'Windows Security UI',
  'Bluetooth',
  'Xbox functionality',
  'File sharing',
  'Some UWP applications',
];

export function AggressiveServicesProfile() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const apply = () => {
    setConfirmOpen(false);
    setMessage(
      'This confirmation flow is ready, but the underlying service changes are still pending a safety review before release — nothing on your system was touched.'
    );
  };

  return (
    <div className="ft-card p-5 flex flex-col gap-4 border border-[rgba(248,85,95,0.3)]">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-[rgba(248,85,95,0.12)] flex items-center justify-center shrink-0">
          <AlertOctagon size={16} className="text-[var(--ft-danger)]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--ft-text-primary)]">Aggressive Low-Latency Services Profile</h2>
          <p className="text-[11px] uppercase tracking-wide text-[var(--ft-danger)] font-medium mt-0.5">Advanced / Aggressive</p>
        </div>
      </div>

      <div className="bg-[rgba(248,85,95,0.06)] border border-[rgba(248,85,95,0.2)] rounded-[8px] p-3">
        <p className="text-xs text-[var(--ft-text-secondary)] mb-2">Applying this profile can break:</p>
        <ul className="text-xs text-[var(--ft-danger)] list-disc list-inside space-y-0.5">
          {BREAKS.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2">
        <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
          Apply Profile
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(true)}>
          Restore Default Services
        </Button>
      </div>

      {message && <p className="text-[11px] text-[var(--ft-text-muted)] leading-relaxed border-t border-[var(--ft-border)] pt-3">{message}</p>}

      {confirmOpen && (
        <ConfirmationDialog
          title="Apply the aggressive services profile?"
          message={`This can break: ${BREAKS.join(', ')}. A reversible backup of your current service configuration would be created first, and you can restore it at any time from this same panel.`}
          confirmLabel="I understand, apply it"
          danger
          onConfirm={apply}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
