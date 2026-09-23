'use client';

/**
 * v2's search component (src/styles/components/search.css).
 *
 * The bordered box is `.search-wrapper`, not the input: the icon, the field
 * and the clear button all sit inside one frame that lights up on focus.
 */
export function SearchBar({
  value,
  onChange,
  resultCount,
  totalCount,
}: {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
}) {
  return (
    <div className="search-section">
      <div className="search-wrapper">
        <span className="search-icon" aria-hidden>
          🔍
        </span>
        <input
          type="text"
          className="search-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ค้นหา..."
          autoComplete="off"
          aria-label="ค้นหาเจ้าหน้าที่"
        />
        <button
          type="button"
          className={`search-clear${value ? ' visible' : ''}`}
          onClick={() => onChange('')}
          aria-label="ล้างการค้นหา"
          tabIndex={value ? 0 : -1}
        >
          ×
        </button>
      </div>

      <div className="search-stats">
        พบ <strong>{resultCount}</strong> นาย · ทั้งหมด <strong>{totalCount}</strong>
      </div>
    </div>
  );
}
