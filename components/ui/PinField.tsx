'use client';

import { useEffect, useRef, useState } from 'react';

/** The admin PIN is four digits, so the row draws four slots — and a value
    that fills them all is complete, which is what lets it submit itself. */
export const PIN_LENGTH = 4;

/**
 * Segmented PIN entry: `PIN_LENGTH` decorative slots drawn over one real
 * off-screen input. A single field is what keeps mobile keyboards, paste and
 * autofill working and keeps the value in one place; the slots only mirror it.
 */
export function PinField({
  value,
  onChange,
  onComplete,
  wrong = false,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Fired the moment the last slot fills, so a 4-digit PIN needs no button. */
  onComplete?: (value: string) => void;
  wrong?: boolean;
  label: string;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* A rejected PIN clears the field, so put the caret back where the next
     attempt will be typed rather than leaving the row dead. */
  useEffect(() => {
    if (wrong) inputRef.current?.focus();
  }, [wrong]);

  return (
    <>
      <div
        className={`pin-slots${wrong ? ' is-wrong' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => {
          const filled = i < value.length;
          const active = focused && i === Math.min(value.length, PIN_LENGTH - 1);

          return (
            <div
              key={i}
              aria-hidden
              className={[
                'pin-slot',
                filled ? 'is-filled' : '',
                active && !filled ? 'is-active' : '',
                wrong ? 'is-wrong' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {filled ? '•' : active ? <span className="pin-caret" /> : null}
            </div>
          );
        })}
      </div>

      <input
        ref={inputRef}
        /* Not type="password": the field itself is invisible — the slots do
           the masking — and a password field invites the browser's saved-
           credential autofill, which lands a complete PIN in one change event
           and fires the submit below before anyone has touched the keyboard.
           "one-time-code" is what marks a short numeric code instead. */
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        data-1p-ignore
        data-lpignore="true"
        value={value}
        maxLength={PIN_LENGTH}
        onChange={(e) => {
          const next = e.target.value.slice(0, PIN_LENGTH);
          onChange(next);
          if (next.length === PIN_LENGTH) onComplete?.(next);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={label}
        /* Off-screen rather than hidden: display:none would make it
           unfocusable and kill typing altogether. */
        className="absolute h-px w-px opacity-0"
      />
    </>
  );
}
