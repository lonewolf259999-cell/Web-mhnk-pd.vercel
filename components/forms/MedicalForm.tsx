'use client';

import { useState } from 'react';
import Link from 'next/link';
import { mutations } from '@/lib/client/queries';
import { useDiscordAuth } from '@/lib/client/useDiscordAuth';
import { CopyButton } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import {
  DiscordConnectPanel,
  DiscordIdField,
  EditSection,
  EditToggle,
  ErrorBox,
  Field,
  FormInput,
  FormTextArea,
  RequiredDiscordNote,
  SubmitBar,
  applicationPageClasses,
} from './ApplicationForm';

const c = applicationPageClasses;

/** Full-height, vertically-centered page shell matching the v2 medical layout. */
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={c.page}>
      <SiteHeader />
      <main className={c.main}>
        <div className="w-full max-w-[650px]">
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-dim transition hover:text-accent"
          >
            ← กลับหน้าหลัก
          </Link>
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

interface FormState {
  icFirstName: string;
  icLastName: string;
  ocAge: string;
  timeStart: string;
  timeEnd: string;
  medicalExperience: string;
  joinReason: string;
}

const EMPTY: FormState = {
  icFirstName: '',
  icLastName: '',
  ocAge: '',
  timeStart: '',
  timeEnd: '',
  medicalExperience: '',
  joinReason: '',
};

export function MedicalForm() {
  const auth = useDiscordAuth('medical');
  const toast = useToast();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [savedMessageId, setSavedMessageId] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [messageId, setMessageId] = useState('');
  const [editCount, setEditCount] = useState(0);
  const [fetching, setFetching] = useState(false);

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  /** Pulls an existing submission back out of its Discord embed. */
  async function loadExisting() {
    if (!messageId.trim()) {
      setErrors(['กรุณาระบุ Message ID']);
      return;
    }

    setFetching(true);
    setErrors([]);

    try {
      const result = await mutations.fetchMedical(messageId.trim(), auth.user?.userId);
      const [first = '', ...rest] = (result.data.icName || '').split(' ');

      setForm({
        icFirstName: first,
        icLastName: rest.join(' '),
        ocAge: result.data.ocAge ? String(result.data.ocAge) : '',
        timeStart: result.data.timeStart,
        timeEnd: result.data.timeEnd,
        medicalExperience: result.data.medicalExperience,
        joinReason: result.data.joinReason,
      });
      setEditCount(result.editCount);
      toast('โหลดข้อมูลสำเร็จ', 'success');
    } catch (err) {
      setErrors([(err as Error).message]);
    } finally {
      setFetching(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.user) return;

    setPending(true);
    setErrors([]);

    const payload = {
      icName: `${form.icFirstName} ${form.icLastName}`.trim(),
      ocAge: Number(form.ocAge),
      timeStart: form.timeStart,
      timeEnd: form.timeEnd,
      medicalExperience: form.medicalExperience,
      joinReason: form.joinReason,
      discordId: auth.user.userId,
      discordUserId: auth.user.userId,
    };

    try {
      if (editMode) {
        const result = await mutations.editMedical({
          ...payload,
          messageId: messageId.trim(),
          editCount,
        });
        setEditCount(result.editCount);
        toast(result.message, 'success');
      } else {
        const result = await mutations.medical(payload);
        setSavedMessageId(result.messageId);
      }
    } catch (err) {
      setErrors([(err as Error).message]);
    } finally {
      setPending(false);
    }
  }

  if (savedMessageId) {
    return (
      <PageShell>
        <div className={c.successCard}>
          <div className={c.successIcon}>✔</div>
          <h2 className={c.successTitle}>สมัครสำเร็จ!</h2>
          <p className={c.successText}>ข้อมูลการสมัครของคุณถูกส่งไปยังทีมงานเรียบร้อยแล้ว</p>
          <p className={c.successNote}>ทีมงานจะติดต่อกลับผ่าน Discord ของคุณ</p>

          <div className={c.copySection}>
            <label className={c.copyLabel}>Message ID (เก็บไว้สำหรับแก้ไขภายหลัง)</label>
            <div className="flex items-center gap-2">
              <input readOnly value={savedMessageId} className={c.copyInput} />
              <CopyButton value={savedMessageId} label="คัดลอก Message ID" />
            </div>
            <p className={c.copyHint}>
              💡 คัดลอก ID นี้ไว้ก่อนปิดหน้าเว็บ ถ้าต้องการแก้ไขข้อมูลครั้งต่อไป
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSavedMessageId(null);
                setForm(EMPTY);
                setEditMode(false);
                setMessageId('');
                setEditCount(0);
              }}
              className={c.resetButton}
            >
              <span className="text-lg">🔄</span> สมัครใหม่
            </button>
            <button
              type="button"
              onClick={() => {
                setMessageId(savedMessageId);
                setEditMode(true);
                setSavedMessageId(null);
              }}
              className={c.editAfterSuccessButton}
            >
              ✎ แก้ไขข้อมูลนี้
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className={c.card}>
        <div className={c.header}>
          <div className={c.headerIcon}>💙</div>
          <h2 className={c.headerTitleDanger}>สมัครเป็นแพทย์</h2>
          <p className={c.headerDesc}>กรอกข้อมูลด้านล่างเพื่อสมัครเข้าร่วมหน่วยแพทย์ MHNK</p>
        </div>

        <DiscordConnectPanel auth={auth} />

        {auth.failed && <ErrorBox errors={['เชื่อมต่อ Discord ล้มเหลว กรุณาลองใหม่อีกครั้ง']} />}

        <form onSubmit={submit} className="flex flex-col gap-6">
          <DiscordIdField userId={auth.user?.userId ?? ''} />

          <EditToggle
            editMode={editMode}
            onToggle={() => {
              setEditMode((v) => !v);
              setErrors([]);
            }}
          />

          {editMode && (
            <EditSection
              messageId={messageId}
              onMessageIdChange={setMessageId}
              onFetch={loadExisting}
              fetching={fetching}
              onCancel={() => {
                setEditMode(false);
                setMessageId('');
                setEditCount(0);
                setErrors([]);
              }}
            />
          )}

          <Field icon="📝" label="ชื่อ - นามสกุล (IC / ตามบัตร)">
            <div className="flex flex-col gap-3 min-[481px]:flex-row min-[481px]:gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <FormInput
                  value={form.icFirstName}
                  onChange={set('icFirstName')}
                  placeholder="ชื่อจริง"
                  maxLength={50}
                  required
                />
                <span className={c.hintSmall}>ชื่อจริง (ห้ามเว้นวรรค)</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <FormInput
                  value={form.icLastName}
                  onChange={set('icLastName')}
                  placeholder="นามสกุล"
                  maxLength={50}
                  required
                />
                <span className={c.hintSmall}>นามสกุล (ห้ามเว้นวรรค)</span>
              </div>
            </div>
          </Field>

          <Field icon="🎂" label="อายุ (OC)" hint="อายุของตัวละครในเกม">
            <FormInput
              type="number"
              value={form.ocAge}
              onChange={set('ocAge')}
              placeholder="กรอกอายุตัวละคร"
              min={1}
              max={120}
              required
            />
          </Field>

          <Field
            icon="🕒"
            label="เวลาที่สามารถปฏิบัติหน้าที่ได้"
            hint="เลือกช่วงเวลาที่สามารถออนไลน์และปฏิบัติหน้าที่ได้ เช่น 18:00 - 00:00"
          >
            <div className="flex items-center gap-2">
              <FormInput type="time" value={form.timeStart} onChange={set('timeStart')} required />
              <span className="text-ink-dim">-</span>
              <FormInput type="time" value={form.timeEnd} onChange={set('timeEnd')} required />
            </div>
          </Field>

          <Field
            icon="🏥"
            label="มีประสบการณ์ด้านสายแพทย์มาก่อนหรือไม่ (โปรดระบุ)"
            hint='ระบุประสบการณ์หรือความรู้ด้านสายแพทย์ที่มี (ถ้าไม่มีให้ระบุว่า "ไม่มี")'
          >
            <FormTextArea
              value={form.medicalExperience}
              onChange={set('medicalExperience')}
              placeholder="เช่น เคยเป็นแพทย์ในเซิร์ฟอื่น, มีความรู้ด้านการรักษา, เคยผ่านการฝึกอบรม..."
              rows={4}
              maxLength={500}
              required
            />
          </Field>

          <Field
            icon="💡"
            label="เหตุผลที่ต้องการเข้าร่วมหน่วยแพทย์"
            hint="เขียนเหตุผลที่ต้องการเข้าร่วมหน่วยแพทย์ MHNK"
          >
            <FormTextArea
              value={form.joinReason}
              onChange={set('joinReason')}
              placeholder="บอกเหตุผลที่อยากเข้าร่วมหน่วยแพทย์ของเรา..."
              rows={4}
              maxLength={500}
              required
            />
          </Field>

          <ErrorBox errors={errors} />

          <SubmitBar
            editMode={editMode}
            pending={pending}
            disabled={!auth.user}
            label="สมัครสมาชิก"
            tone="danger"
          />

          {!auth.user && <RequiredDiscordNote>กรุณาเชื่อมต่อ Discord ก่อนสมัคร</RequiredDiscordNote>}
        </form>
      </div>
    </PageShell>
  );
}
