'use client';

import { useState } from 'react';
import { filterByQuery, groupByCategory } from '@/lib/format';
import { sanitizeRichText } from '@/lib/sanitize';
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
import type { ConductItem, RuleItem, RulesType } from '@/lib/types';

interface Props {
  items: RuleItem[] | ConductItem[] | null;
  loading: boolean;
  error: string | null;
  query: string;
  onRetry: () => void;
  /** 'category' for rules/fines, 'title' for conduct */
  groupField: 'category' | 'title';
  icon: string;
  title: string;
  emptyTitle: string;
  type: RulesType;
  adminMode: boolean;
  onDataChanged: () => void;
  headerTrailing?: React.ReactNode;
}

type Entry = RuleItem & ConductItem;

const EMPTY_FIELDS: RuleFormFields = { category: '', text: '', amount: '', time: '' };

export function RulesView({
  items,
  loading,
  error,
  query,
  onRetry,
  groupField,
  icon,
  title,
  emptyTitle,
  type,
  adminMode,
  onDataChanged,
  headerTrailing,
}: Props) {
  const toast = useToast();
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; item: Entry | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [pending, setPending] = useState(false);

  const groups = items ? groupByCategory(items as Entry[], groupField) : {};

  const visible = Object.entries(groups)
    .map(
      ([category, entries]) =>
        [category, filterByQuery(entries, query, ['text', groupField])] as const
    )
    .filter(([, entries]) => entries.length > 0);

  async function handleSave(fields: RuleFormFields) {
    const pin = readPin();
    if (!pin) {
      toast('กรุณาเข้าโหมดผู้ดูแลก่อน', 'error');
      return;
    }

    const isEdit = modal?.mode === 'edit' && modal.item;
    const id = isEdit ? modal.item!.id : generateRuleId(type);
    const data: Record<string, string> = {
      text: fields.text,
      amount: fields.amount,
      time: fields.time,
      ...(type === 'conduct' ? { title: fields.category } : { category: fields.category }),
    };

    setPending(true);
    try {
      if (isEdit) {
        await mutations.updateRuleItem(type, id, pin, data);
        toast('✅ แก้ไขข้อมูลสำเร็จ', 'success');
      } else {
        await mutations.addRuleItem(type, pin, data);
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
      await mutations.deleteRuleItem(type, deleteTarget.id, pin);
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
      <SectionHeader icon={icon} title={title} trailing={headerTrailing} />

      {adminMode && <AdminBar onAdd={() => setModal({ mode: 'add', item: null })} />}

      {loading && <Loading />}
      {!loading && error && <ErrorState message={error} onRetry={onRetry} />}

      {!loading && !error && visible.length === 0 && (
        <EmptyState icon="📭" title={emptyTitle} message="ลองค้นหาด้วยคำอื่น" />
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="space-y-4">
          {visible.map(([category, entries]) => (
            <div key={category} className="panel p-4">
              <h3 className="mb-3 border-b border-accent/12 pb-2 text-sm font-bold text-accent">
                {category}
              </h3>

              <ol className="space-y-2">
                {entries.map((entry, index) => (
                  <li
                    key={entry.id}
                    className="flex items-start gap-2.5 rounded-sm px-2 py-1.5 text-sm leading-relaxed transition hover:bg-white/[0.03]"
                  >
                    <span className="shrink-0 font-semibold text-ink-dim tabular-nums">
                      {index + 1}.
                    </span>
                    <span
                      className="min-w-0 flex-1 text-ink/90"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeRichText(entry.text).replace(/\n/g, '<br>'),
                      }}
                    />
                    {adminMode && (
                      <AdminItemActions
                        onEdit={() => setModal({ mode: 'edit', item: entry })}
                        onDelete={() => setDeleteTarget(entry)}
                      />
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <RuleFormModal
          type={type}
          mode={modal.mode}
          initial={
            modal.item
              ? {
                  category: (groupField === 'title' ? modal.item.title : modal.item.category) ?? '',
                  text: modal.item.text ?? '',
                  amount: '',
                  time: '',
                }
              : EMPTY_FIELDS
          }
          categories={collectCategories((items as Entry[]) ?? [], type)}
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
