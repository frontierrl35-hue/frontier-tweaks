import { useState } from 'react';
import { Info, ShieldAlert, ShieldCheck, TriangleAlert, Lock, Sparkles } from 'lucide-react';
import { Toggle } from '../buttons/Toggle';
import { StatusBadge } from './StatusBadge';
import { ConfirmationDialog } from '../dialogs/ConfirmationDialog';
import { getTweakIcon } from '../../lib/tweakIcons';
import { useAccountStore } from '../../stores/accountStore';
import { DISCORD_URL } from '../../../shared/types';
import type { TweakMeta, TweakStatus } from '../../../shared/types';

/** Deterministic true/false split from the tweak id — used to alternate the
 *  icon tint between violet and pink so a grid of cards doesn't read as
 *  visually flat, without depending on list position (which changes under
 *  search/sort/filter). */
function altTint(id: string): boolean {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return sum % 2 === 0;
}

interface Props {
  tweak: TweakMeta;
  status: TweakStatus;
  onApply: () => void;
  onRevert: () => void;
  busy?: boolean;
}

const RISK_CHIP: Record<TweakMeta['risk'], { className: string; label: string }> = {
  low: { className: 'text-[var(--ft-text-muted)]', label: 'Low risk' },
  medium: { className: 'text-[var(--ft-warning)]', label: 'Medium risk' },
  high: { className: 'text-[var(--ft-danger)]', label: 'High risk' },
};

export function TweakCard({ tweak, status, onApply, onRevert, busy }: Props) {
  const [showInfo, setShowInfo] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { signedIn, premium } = useAccountStore();
  const isApplied = status === 'applied';
  const isUnsupported = status === 'unsupported';
  const lockedOn = isApplied && !tweak.reversible;
  const premiumLocked = tweak.tier === 'premium' && !premium;

  const handleToggle = (next: boolean) => {
    if (premiumLocked) {
      if (signedIn) window.frontier.system.openExternal(DISCORD_URL);
      else useAccountStore.getState().login();
      return;
    }
    if (next) {
      if (tweak.dangerous) setConfirmOpen(true);
      else onApply();
    } else if (!lockedOn) {
      onRevert();
    }
  };

  const risk = RISK_CHIP[tweak.risk];
  const Icon = getTweakIcon(tweak.id);
  const pink = altTint(tweak.id);

  return (
    <div
      className={`ft-card ft-glow-on-hover p-5 flex flex-col gap-3 ${tweak.dangerous ? 'border-[rgba(248,85,95,0.35)]' : ''} ${premiumLocked ? 'opacity-80' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          <div
            className="shrink-0 w-9 h-9 rounded-[var(--ft-radius-sm)] flex items-center justify-center"
            style={{
              background: pink ? 'var(--ft-accent-2-soft)' : 'var(--ft-accent-soft)',
              color: pink ? 'var(--ft-accent-2)' : 'var(--ft-accent-light)',
            }}
          >
            <Icon size={17} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-[var(--ft-text-primary)]">{tweak.name}</h3>
              {tweak.isNew && <span className="ft-tag-new">New</span>}
              {tweak.tier === 'premium' && (
                <span className="flex items-center gap-0.5 text-[9px] font-medium text-[var(--ft-accent-light)] bg-[var(--ft-accent-soft)] px-1.5 py-0.5 rounded-full">
                  <Sparkles size={9} />
                  Premium
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--ft-text-secondary)] mt-1 leading-relaxed">{tweak.description}</p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2.5">
          {tweak.longDescription && (
            <button
              onClick={() => setShowInfo((v) => !v)}
              className="no-drag text-[var(--ft-text-muted)] hover:text-[var(--ft-text-secondary)] transition"
              aria-label="More info"
            >
              <Info size={15} />
            </button>
          )}
          {!isUnsupported && premiumLocked && (
            <button
              onClick={() => handleToggle(true)}
              className="no-drag flex items-center gap-1 text-[10px] font-medium text-[var(--ft-accent-light)] bg-[var(--ft-accent-soft)] px-2 py-1 rounded-full shrink-0 hover:brightness-110 transition"
              title={signedIn ? 'Requires the Premium Tweaker role — join the Discord' : 'Sign in with Discord to check for premium access'}
            >
              <Lock size={11} />
              Premium
            </button>
          )}
          {!isUnsupported && !premiumLocked && (
            <Toggle
              checked={isApplied}
              onChange={handleToggle}
              disabled={busy || lockedOn}
              loading={busy}
              aria-label={`Toggle ${tweak.name}`}
            />
          )}
        </div>
      </div>

      {showInfo && tweak.longDescription && (
        <p className="text-[11px] text-[var(--ft-text-muted)] bg-[var(--ft-surface-sunken)] border border-[var(--ft-border)] rounded-[8px] p-2.5 leading-relaxed">
          {tweak.longDescription}
        </p>
      )}

      {tweak.dangerous && tweak.dangerWarning && (
        <div className="flex items-start gap-2 bg-[var(--ft-danger-soft)] border border-[rgba(248,85,95,0.25)] rounded-[8px] p-2.5">
          <TriangleAlert size={14} className="text-[var(--ft-danger)] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[var(--ft-danger)] leading-relaxed">{tweak.dangerWarning}</p>
        </div>
      )}

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5">
          <span className="ft-chip" title={risk.label}>
            <ShieldAlert size={13} className={risk.className} />
          </span>
          {tweak.requiresAdmin && (
            <span className="ft-chip" title="Requires administrator">
              <Lock size={12} className="text-[var(--ft-text-muted)]" />
            </span>
          )}
          {tweak.reversible && (
            <span className="ft-chip" title="Reversible">
              <ShieldCheck size={13} className="text-[var(--ft-success)]" />
            </span>
          )}
        </div>
        {(status === 'error' || status === 'unknown' || isUnsupported) && <StatusBadge status={status} />}
      </div>

      {isUnsupported && tweak.unsupportedReason && (
        <p className="text-[11px] text-[var(--ft-text-muted)] leading-relaxed">{tweak.unsupportedReason}</p>
      )}
      {lockedOn && (
        <span className="text-[10px] text-[var(--ft-text-muted)]">Applied — this change can't be reverted automatically</span>
      )}

      {confirmOpen && (
        <ConfirmationDialog
          title={`Apply "${tweak.name}"?`}
          message={tweak.dangerWarning ?? 'This is a higher-risk change. Are you sure you want to continue?'}
          confirmLabel="I understand, apply it"
          danger
          onConfirm={() => {
            setConfirmOpen(false);
            onApply();
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
