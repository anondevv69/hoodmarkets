import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      aria-label="Copy address"
      title="Copy address"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
