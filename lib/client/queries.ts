'use client';

/* Typed API calls. Every path, param and result here is inferred from the
   Elysia server — change a route and these stop compiling. */

import { client, unwrap } from './eden';
import type { CaseItem, ConductItem, FineItem, RuleItem, RulesType } from '@/lib/types';

/* /rules-data/:type serves four shapes behind one route, so Eden infers the
   union of all of them. The literal passed in determines which arm comes
   back, which only these wrappers know — hence the narrowing here. */
type RulesUnion = ConductItem[] | RuleItem[] | CaseItem[];

const narrow = <T extends RulesUnion>(p: Promise<RulesUnion>) => p as Promise<T>;

export const queries = {
  officers: () => unwrap(client.api.officers.get()),

  weeks: () => unwrap(client.api.weeks.get()),

  weekData: (name: string) => unwrap(client.api['week-data'].get({ query: { name } })),

  weekTop10: () => unwrap(client.api['week-top10'].get()),

  scheduleConfig: () => unwrap(client.api['schedule-config'].get()),

  cases: () => narrow<CaseItem[]>(unwrap(client.api['rules-data']({ type: 'cases' }).get())),

  conduct: () =>
    narrow<ConductItem[]>(unwrap(client.api['rules-data']({ type: 'conduct' }).get())),

  rules: () => narrow<RuleItem[]>(unwrap(client.api['rules-data']({ type: 'rules' }).get())),

  fines: () => narrow<FineItem[]>(unwrap(client.api['rules-data']({ type: 'fines' }).get())),
};

export const mutations = {
  refresh: (pin: string) => unwrap(client.api.refresh.post({ pin })),

  /** Is this the admin PIN? Answers without performing an admin action.
      On success the server also sets the HttpOnly admin cookie. */
  verifyPin: (pin: string) => unwrap(client.api.pin.verify.post({ pin })),

  /** Is the admin cookie still live? Costs no PIN attempt. */
  adminSession: () => unwrap(client.api.pin.session.get()),

  /** Ends the admin session — only the server can clear an HttpOnly cookie. */
  adminLogout: () => unwrap(client.api.pin.logout.post()),

  /** Ends the Discord session, for the same reason: the cookie is HttpOnly. */
  discordLogout: () => unwrap(client.api.discord.logout.post()),

  markPaid: (
    input: { pin: string; weekName: string; officerName: string; idempotencyKey?: string },
    signal?: AbortSignal
  ) => unwrap(client.api['mark-paid'].post(input, { fetch: { signal } })),

  /** Used to resolve a payment whose response was lost to a timeout. */
  paymentStatus: (key: string) =>
    unwrap(client.api['mark-paid'].status.get({ query: { key } })),

  register: (input: Parameters<typeof client.api.register.post>[0]) =>
    unwrap(client.api.register.post(input)),

  editRegister: (input: Parameters<(typeof client.api.register)['edit']['patch']>[0]) =>
    unwrap(client.api.register.edit.patch(input)),

  fetchRegister: (messageId: string, discordUserId?: string) =>
    unwrap(client.api.register.fetch({ messageId }).get({ query: { discordUserId } })),

  medical: (input: Parameters<typeof client.api.medical.post>[0]) =>
    unwrap(client.api.medical.post(input)),

  editMedical: (input: Parameters<(typeof client.api.medical)['edit']['patch']>[0]) =>
    unwrap(client.api.medical.edit.patch(input)),

  fetchMedical: (messageId: string, discordUserId?: string) =>
    unwrap(client.api.medical.fetch({ messageId }).get({ query: { discordUserId } })),

  /* ---- admin ---- */

  listPending: (pin: string) => unwrap(client.api.pending.post({ pin })),

  approvePending: (row: number, input: { pin: string; proctorDiscordId: string; proctorDiscordName?: string }) =>
    unwrap(client.api.pending.approve({ row }).post(input)),

  rejectPending: (row: number, pin: string) =>
    unwrap(client.api.pending.reject({ row }).post({ pin })),

  /* ---- rostermanage: gated by the Discord allowlist, not a PIN ----
     Nothing here carries a credential. The signed Discord session cookie rides
     along automatically and the server matches it against the list in the
     sheet, so there is no longer anything for the page to hold or to send. */

  /** Am I signed in, and am I on the list? Asked on every page load, because
      the session cookie is HttpOnly and the page cannot read it itself. */
  rosterAccess: () => unwrap(client.api.roster.access.get()),

  namePD: () => unwrap(client.api.roster.namepd.post()),

  outDC: () => unwrap(client.api.roster.outdc.post()),

  setRosterStatus: (row: number, status: string) =>
    unwrap(client.api.roster.status({ row }).put({ status })),

  moveOut: (row: number, reason: string) =>
    unwrap(client.api.roster['move-out']({ row }).post({ reason })),

  /* ---- conduct/rules/fines admin CRUD ---- */

  addRuleItem: (type: RulesType, pin: string, data: Record<string, string>) =>
    unwrap(client.api['rules-data']({ type }).post({ pin, ...data })),

  updateRuleItem: (type: RulesType, id: string, pin: string, data: Record<string, string>) =>
    unwrap(client.api['rules-data']({ type })({ id }).put({ pin, ...data })),

  deleteRuleItem: (type: RulesType, id: string, pin: string) =>
    unwrap(client.api['rules-data']({ type })({ id }).delete({ pin })),
};
