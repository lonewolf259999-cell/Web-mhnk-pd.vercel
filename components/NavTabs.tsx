'use client';

const PAGES = [
  { id: 'roster', icon: '⚖', label: 'รายชื่อ' },
  { id: 'cases', icon: '⚖', label: 'การทำคดี' },
  { id: 'conduct', icon: '📚', label: 'ข้อปฏิบัติ' },
  { id: 'rules', icon: '📖', label: 'กฎตำรวจ' },
  { id: 'fines', icon: '💰', label: 'ค่าปรับ' },
  { id: 'schedule', icon: '📅', label: 'ตารางเวร' },
] as const;

export type PageId = (typeof PAGES)[number]['id'];

/** v2's tab strip (src/styles/components/nav.css). The icon lives in its own
    span because the narrowest breakpoint hides it and keeps the label. */
export function NavTabs({
  active,
  onChange,
}: {
  active: PageId;
  onChange: (page: PageId) => void;
}) {
  return (
    <nav className="nav-tabs" aria-label="หน้าหลัก">
      {PAGES.map((page) => {
        const isActive = page.id === active;
        return (
          <button
            key={page.id}
            type="button"
            onClick={() => onChange(page.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`nav-tab${isActive ? ' active' : ''}`}
          >
            <span aria-hidden>{page.icon}</span> {page.label}
          </button>
        );
      })}
    </nav>
  );
}
