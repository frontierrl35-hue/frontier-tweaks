interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  'aria-label'?: string;
}

export function Toggle({ checked, onChange, disabled, loading, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled || loading}
      data-on={checked}
      data-disabled={disabled || loading}
      onClick={() => onChange(!checked)}
      className="ft-toggle no-drag"
      {...rest}
    >
      <span className="ft-toggle-thumb" />
    </button>
  );
}
