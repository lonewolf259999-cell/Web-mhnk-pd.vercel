import Link from 'next/link';

/** The way back to the roster from any page that is not it. Drawn the same
    everywhere on purpose — /police and /regulation already looked like this,
    and the pages that had no way back now match them rather than each
    inventing their own. */
export function BackHome({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-semibold text-ink-dim transition hover:bg-accent/10 hover:text-accent ${className}`}
    >
      <span aria-hidden>←</span> กลับหน้าหลัก
    </Link>
  );
}
