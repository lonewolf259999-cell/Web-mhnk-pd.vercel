'use client';

import { useState } from 'react';
import { filterByQuery, formatCurrency, groupByCategory } from '@/lib/format';
import { EmptyState, ErrorState, Loading, SectionHeader } from '@/components/ui/States';
import { mutations } from '@/lib/client/queries';
import { readPin } from '@/lib/client/adminPin';
import { useToast } from '@/components/ui/Toast';
import {
  AdminBar,
  AdminItemActions,
  RuleDeleteModal,
  RuleFormModal,
  collectCategories,
  generateRuleId,
  type RuleFormFields,
} from '@/components/admin/RulesAdmin';
import type { FineItem } from '@/lib/types';

const EMPTY_FIELDS: RuleFormFields = { category: '', text: '', amount: '', time: '' };

function formatTime(minutes: string): string {
  if (!minutes || minutes === '0') return '-';
  return `${minutes} นาที`;
}

/** Amounts are baht, but some rows hold a multiplier like "x10" instead. */
function formatAmount(amount: string): string {
  const value = formatCurrency(amount);
  return /^\d/.test(value.trim()) ? `฿${value}` : value;
}

export function FinesView({
  items,
  loading,
  error,
  query,
  onRetry,
  adminMode,
  onDataChanged,
}: {
  items: FineItem[] | null;
  loading: boolean;
  error: string | null;
  query: string;
  onRetry: () => void;
  adminMode: boolean;
  onDataChanged: () => void;
}) {
  const toast = useToast();
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; item: FineItem | null } | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<FineItem | null>(null);
  const [pending, setPending] = useState(false);

  const groups = items ? groupByCategory(items, 'category') : {};

  const visible = Object.entries(groups)
    .map(
      ([category, entries]) =>
        [category, filterByQuery(entries, query, ['text', 'category'])] as const
    )
    .filter(([, entries]) => entries.length > 0);

  async function handleSave(fields: RuleFormFields) {
    const pin = readPin();
    if (!pin) {
      toast('กรุณาเข้าโหมดผู้ดูแลก่อน', 'error');
      return;
    }

    const isEdit = modal?.mode === 'edit' && modal.item;
    const id = isEdit ? modal.item!.id : generateRuleId('fines');
    const data = { category: fields.category, text: fields.text, amount: fields.amount, time: fields.time };

    setPending(true);
    try {
      if (isEdit) {
        await mutations.updateRuleItem('fines', id, pin, data);
        toast('✅ แก้ไขข้อมูลสำเร็จ', 'success');
      } else {
        await mutations.addRuleItem('fines', pin, data);
        toast('✅ เพิ่มข้อมูลสำเร็จ', 'success');
      }
      setModal(null);
      onDataChanged();
    } catch (err) {
      toast('❌ ' + (err as Error).message, 'error');
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    const pin = readPin();
    if (!pin || !deleteTarget) return;

    setPending(true);
    try {
      await mutations.deleteRuleItem('fines', deleteTarget.id, pin);
      toast('🗑️ ลบข้อมูลสำเร็จ', 'success');
      setDeleteTarget(null);
      onDataChanged();
    } catch (err) {
      toast('❌ ' + (err as Error).message, 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <SectionHeader icon="💰" title="อัตราค่าปรับ" />

      {adminMode && <AdminBar onAdd={() => setModal({ mode: 'add', item: null })} />}

      {loading && <Loading />}
      {!loading && error && <ErrorState message={error} onRetry={onRetry} />}

      {!loading && !error && visible.length === 0 && (
        <EmptyState icon="📭" title="ไม่พบค่าปรับที่ค้นหา" message="ลองค้นหาด้วยคำอื่น" />
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="space-y-4">
          {visible.map(([category, entries]) => (
            <div key={category} className="panel overflow-hidden">
              <h3 className="border-b border-accent/12 bg-accent/5 px-4 py-2.5 text-sm font-bold text-accent">
                {category}
              </h3>

              <div className="divide-y divide-white/5">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm transition hover:bg-white/[0.03] sm:grid-cols-[1fr_7rem_6rem_auto]"
                  >
                    <span className="min-w-0 text-ink/90">{entry.text}</span>
                    <span className="text-right font-bold text-gold tabular-nums">
                      {formatAmount(entry.amount)}
                    </span>
                    <span className="col-span-2 text-right text-xs text-ink-dim sm:col-span-1">
                      {formatTime(entry.time)}
                    </span>
                    {adminMode && (
                      <span className="col-span-2 flex justify-end sm:col-span-1">
                        <AdminItemActions
                          onEdit={() => setModal({ mode: 'edit', item: entry })}
                          onDelete={() => setDeleteTarget(entry)}
                        />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <RuleFormModal
          type="fines"
          mode={modal.mode}
          initial={
            modal.item
              ? {
                  category: modal.item.category ?? '',
                  text: modal.item.text ?? '',
                  amount: modal.item.amount ?? '',
                  time: modal.item.time ?? '',
                }
              : EMPTY_FIELDS
          }
          categories={collectCategories(items ?? [], 'fines')}
          pending={pending}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {deleteTarget && (
        <RuleDeleteModal
          pending={pending}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}
