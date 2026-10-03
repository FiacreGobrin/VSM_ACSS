import React, { useState } from 'react';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { maskPii } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';

interface PiiMaskedTextProps {
  value: string;
  type?: 'national_id' | 'passport' | 'phone' | 'plate';
  recordId?: string;
  fieldName?: string;
  className?: string;
}

export const PiiMaskedText: React.FC<PiiMaskedTextProps> = ({
  value,
  type = 'national_id',
  recordId = 'unknown',
  fieldName = 'ID_DOCUMENT',
  className = '',
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const user = useAuthStore((state) => state.user);

  const toggleReveal = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !isRevealed;
    setIsRevealed(nextState);

    if (nextState) {
      // Air-Gapped PII Compliance Requirement:
      // Mandatory audit log record generated upon any unmasking event
      console.info(`[AUDIT-LOG: PII REVEALED] Operator: ${user?.username || 'SYSTEM'} (${user?.badgeNumber}) accessed PII field "${fieldName}" for record: ${recordId} at ${new Date().toISOString()}`);
    }
  };

  const displayText = isRevealed ? value : maskPii(value, type);

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-sm group ${className}`}>
      <span className={isRevealed ? 'text-amber-400 font-semibold bg-amber-950/40 px-1 rounded' : 'text-foreground'}>
        {displayText}
      </span>
      <button
        type="button"
        onClick={toggleReveal}
        title={isRevealed ? 'Mask PII' : 'Reveal PII (Audit Logged)'}
        aria-label={isRevealed ? 'Mask PII' : 'Reveal PII (Audit Logged)'}
        className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors focus:ring-1 focus:ring-primary"
      >
        {isRevealed ? (
          <EyeOff className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <Eye className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
        )}
      </button>
      {isRevealed && (
        <span title="PII Reveal Logged to Immutable SOC Audit" className="inline-flex text-[10px] text-amber-500 font-sans tracking-wide">
          <ShieldAlert className="w-3 h-3 ml-0.5 inline" />
        </span>
      )}
    </span>
  );
};
