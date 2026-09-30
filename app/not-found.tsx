import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';

/* Next's built-in 404 is an unstyled English page with no way back. Every
   other page here is Thai and sits inside the site chrome, so a mistyped URL
   should too. */

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="panel w-full max-w-md px-6 py-12 text-center">
          <div className="mb-4 text-[64px] leading-none font-extrabold text-accent">404</div>

          <h1 className="text-lg font-bold text-ink">ไม่พบหน้าที่คุณค้นหา</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-dim">
            ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-night transition hover:-translate-y-px hover:bg-accent-dark"
            >
              <span aria-hidden>←</span> กลับหน้าหลัก
            </Link>
            <Link
              href="/police"
              className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-6 py-2.5 text-sm font-bold text-accent transition hover:border-accent/60 hover:bg-accent/20"
            >
              ⚖ ศูนย์รวมระบบตำรวจ
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
