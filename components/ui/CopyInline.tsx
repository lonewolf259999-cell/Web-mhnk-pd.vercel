'use client';

import { useState } from 'react';

function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/**
 * The little copy affordance that sits next to an ID or an amount.
 * It swaps to a tick for a second, exactly as v2's `copyClipboard` did.
 */
export function CopyInline({
  value,
  title = 'คัดลอก',
  size = 14,
  className,
}: {
  value: string;
  title?: string;
  size?: number;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch {
      /* clipboard blocked — nothing useful to show */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={title}
      aria-label={title}
      className={className}
      style={{
        cursor: 'pointer',
        marginLeft: 4,
        opacity: 0.8,
        display: 'inline-flex',
        verticalAlign: 'middle',
        background: 'none',
        border: 'none',
        padding: 0,
        color: copied ? '#2ecc71' : 'inherit',
      }}
    >
      {copied ? '✅' : <CopyIcon size={size} />}
    </button>
  );
}
