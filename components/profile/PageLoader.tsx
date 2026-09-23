'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react';
import './PageLoader.css';

const LOADING = 'กำลังเริ่มระบบ…';
const READY = 'พร้อมใช้งาน ✓';

/* v2's boot sequence floors: assets, database, officer, payment checks. */
const FLOORS = [12, 40, 60, 80];

/**
 * Full-page boot screen, ported from v2's src/profile/PageLoader.js.
 *
 * The bar eases toward the floor for the current stage rather than jumping to
 * it, so a slow Sheets round trip still reads as progress instead of a frozen
 * number. `stage` counts up as data arrives; `ready` runs it out to 100 and
 * fades the screen away.
 */
export function PageLoader({ stage, ready }: { stage: number; ready: boolean }) {
  const target = ready ? 100 : (FLOORS[Math.min(stage, FLOORS.length - 1)] ?? FLOORS[0]);

  const [percent, setPercent] = useState(0);
  const [fading, setFading] = useState(false);
  const [hidden, setHidden] = useState(false);

  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    const timer = setInterval(() => {
      setPercent((current) => {
        const goal = targetRef.current;
        if (current < goal) return Math.min(goal, current + Math.max(1.2, (goal - current) * 0.06));
        if (current > goal) return Math.max(goal, current - 2);
        return current;
      });
    }, 40);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const fade = setTimeout(() => setFading(true), 700);
    const gone = setTimeout(() => setHidden(true), 1450);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
  }, [ready]);

  if (hidden) return null;

  return (
    <div className={`page-loader${fading ? ' is-ready' : ''}`} role="status" aria-live="polite">
      <div className="pl-panel">
        <div className="pl-crest">
          <div className="pl-ring pl-ring--outer" />
          <div className="pl-ring pl-ring--mid" />
          <div className="pl-core">
            <img className="pl-logo" src="/logo.gif" alt="MHNK PD Logo" />
          </div>
        </div>

        <div className="pl-brand">MHNK</div>
        <div className="pl-desc">POLICE DEPARTMENT · MAHAHORN DIWA</div>

        <div className="pl-progress">
          <div className="pl-track">
            <div className="pl-fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="pl-meta">
            <span className="pl-status">{ready ? READY : LOADING}</span>
            <span className="pl-percent">{Math.round(percent)}%</span>
          </div>
        </div>

        <div className="pl-dots">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
