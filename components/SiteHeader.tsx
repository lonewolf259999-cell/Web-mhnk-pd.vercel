/* eslint-disable @next/next/no-img-element */

export function SiteHeader({
  children,
  extraBadge,
  title = 'Mahahorn Diwa Police Department',
  unit = 'กรมตำรวจ',
  badge = '⚖ POLICE',
}: {
  children?: React.ReactNode;
  extraBadge?: React.ReactNode;
  /** Department name in the header — the medical pages carry their own. */
  title?: string;
  unit?: string;
  badge?: string;
}) {
  return (
    <header className="relative z-10 border-b border-accent/12 bg-gradient-to-b from-[rgba(15,23,42,0.98)] to-[rgba(10,15,30,0.95)] px-4 pt-3 pb-4 md:px-6 md:pt-4 md:pb-5">
      <div className="mb-4 flex flex-wrap items-center justify-center gap-3 md:mb-5 md:gap-4">
        <img
          src="/logo.gif"
          alt="MHNK PD Logo"
          width={72}
          height={72}
          className="h-14 w-14 shrink-0 object-cover transition-transform duration-300 hover:scale-105 md:h-[72px] md:w-[72px]"
        />

        <div>
          <h1 className="text-center text-[0.95rem] font-bold text-ink md:text-[1.15rem]">
            {title}
          </h1>
          <div className="mt-0.5 text-center text-[0.55rem] tracking-[2px] text-ink-dim uppercase md:text-[0.6rem] md:tracking-[3px]">
            {unit} <span className="text-accent">MHNK</span> — Mahahorn Diwa
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-1.5 md:flex">
          <HeaderBadge>◆ FIVEM</HeaderBadge>
          <HeaderBadge>{badge}</HeaderBadge>
          {extraBadge}
        </div>
      </div>

      {children}
    </header>
  );
}

function HeaderBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-accent/15 bg-accent/10 px-2.5 py-1 text-[0.55rem] font-bold tracking-wide text-accent">
      {children}
    </span>
  );
}

export function SiteFooter({ department = 'MHNK POLICE DEPARTMENT' }: { department?: string }) {
  return (
    <footer className="relative z-10 border-t border-accent/12 px-6 py-6 text-center text-xs text-ink-dim">
      <p>
        © 2026 <span className="font-semibold text-accent">{department}</span> — FiveM Server
      </p>
    </footer>
  );
}
