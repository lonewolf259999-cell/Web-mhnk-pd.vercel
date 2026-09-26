import { Elysia, t } from 'elysia';
import {
  editMedical,
  editRegistration,
  fetchMedical,
  fetchRegistration,
  sendMedical,
  sendRegistration,
} from '@/server/services/discord';
import {
  addPendingRegistration,
  findPendingMessageId,
  updatePendingRegistration,
} from '@/server/services/pending';
import {
  addMedicalApplication,
  findMedicalMessageId,
  updateMedicalApplication,
} from '@/server/services/medicalApplications';
import { ApiError } from '@/server/errors';
import { clientKey, rateLimit } from '@/server/rateLimit';
import { readSessionUserId } from '@/server/services/session';

/* v2 rate-limited /api/register (10/min) but not /api/medical — applied
   consistently here to both submission endpoints. */
const SUBMIT_LIMIT = 10;
const SUBMIT_WINDOW_MS = 60_000;

/* Reading and editing an existing application are cheap for the caller and
   expensive for us (each one round-trips to Discord), so they get their own,
   tighter budget than a fresh submission. */
const EDIT_LIMIT = 20;
const EDIT_WINDOW_MS = 60_000;

/**
 * The Discord id this request is actually authenticated as.
 *
 * Deliberately ignores any id in the body or query: those are whatever the
 * client typed, and the id of the person a message belongs to is visible to
 * anyone who can read the embed in Discord. Only the signed session cookie
 * set by the OAuth callback counts.
 */
function requireDiscordUser(request: Request | undefined): string {
  const userId = readSessionUserId(request);
  if (!userId) {
    throw new ApiError('กรุณาเชื่อมต่อ Discord ก่อน (เซสชันหมดอายุหรือยังไม่ได้เข้าสู่ระบบ)', 401);
  }
  return userId;
}

/**
 * Refuses a second application from an account that already has one the page
 * can open for editing.
 *
 * Deliberately keyed on the stored message id, not on merely having a row: an
 * application filed before that id was recorded cannot be found automatically,
 * and blocking those would leave the applicant with no way through at all.
 * Status is not consulted — an approved or rejected applicant edits the same
 * application as anyone else, which is what was asked for.
 */
async function refuseDuplicate(
  request: Request | undefined,
  bodyDiscordId: string,
  find: (id: string) => Promise<string | null>
): Promise<void> {
  const userId = readSessionUserId(request) || bodyDiscordId.trim();
  if (!userId) return;

  if (await find(userId)) {
    throw new ApiError(
      'บัญชี Discord นี้มีใบสมัครอยู่แล้ว — กรุณากดปุ่มแก้ไขข้อมูลเพื่อแก้ใบเดิม แทนการสมัครใหม่',
      409
    );
  }
}

/* Elysia validates shape; these check the business rules the v2 controller
   enforced and return every problem at once, as the forms expect. */

function validatePolice(data: {
  ocName: string;
  icName: string;
  ocAge: number;
  icPhone: string;
  discordId: string;
  steamUrl: string;
}): string[] {
  const errors: string[] = [];

  if (!data.ocName.trim()) errors.push('กรุณากรอกชื่อ OC');
  if (!data.icName.trim()) errors.push('กรุณากรอกชื่อ IC');
  if (!data.ocAge || data.ocAge < 1 || data.ocAge > 120) {
    errors.push('กรุณากรอกอายุ OC ที่ถูกต้อง (1-120)');
  }
  if (!data.icPhone.trim()) errors.push('กรุณากรอกเบอร์ IC');
  if (!data.discordId.trim()) errors.push('กรุณากรอก Discord ID');

  if (!data.steamUrl.trim()) {
    errors.push('กรุณากรอกลิงก์ Steam');
  } else {
    try {
      new URL(data.steamUrl);
    } catch {
      errors.push('กรุณากรอกลิงก์ Steam ที่ถูกต้อง');
    }
  }

  return errors;
}

function validateMedical(data: {
  icName: string;
  ocAge: number;
  timeStart: string;
  timeEnd: string;
  medicalExperience: string;
  joinReason: string;
  discordId: string;
}): string[] {
  const errors: string[] = [];

  if (!data.icName.trim()) errors.push('กรุณากรอกชื่อ - นามสกุล (IC/ตามบัตร)');
  if (!data.ocAge || data.ocAge < 1 || data.ocAge > 120) {
    errors.push('กรุณากรอกอายุ (OC) ที่ถูกต้อง (1-120)');
  }
  if (!data.timeStart.trim()) errors.push('กรุณาระบุเวลาเริ่มปฏิบัติหน้าที่');
  if (!data.timeEnd.trim()) errors.push('กรุณาระบุเวลาสิ้นสุดปฏิบัติหน้าที่');
  if (!data.medicalExperience.trim()) errors.push('กรุณาระบุประสบการณ์ด้านสายแพทย์');
  if (!data.joinReason.trim()) errors.push('กรุณาระบุเหตุผลที่ต้องการเข้าร่วมหน่วยแพทย์');
  if (!data.discordId.trim()) errors.push('กรุณากรอก Discord ID');

  return errors;
}

function reject(errors: string[]): never {
  throw new ApiError(errors.join(' • '), 400);
}

/* `discordUserId` is still accepted on these schemas but no longer read:
   browsers holding a cached bundle keep sending it, and rejecting it would
   break them for no gain. Authorisation comes from requireDiscordUser() —
   do not reintroduce a client-supplied id as an identity. */

const policeBody = t.Object({
  ocName: t.String(),
  icName: t.String(),
  ocAge: t.Numeric(),
  icPhone: t.String(),
  discordId: t.String(),
  discordUserId: t.Optional(t.String()),
  discordDisplayName: t.Optional(t.String()),
  steamUrl: t.String(),
});

const medicalBody = t.Object({
  icName: t.String(),
  ocAge: t.Numeric(),
  timeStart: t.String(),
  timeEnd: t.String(),
  medicalExperience: t.String(),
  joinReason: t.String(),
  discordId: t.String(),
  discordUserId: t.Optional(t.String()),
  discordDisplayName: t.Optional(t.String()),
});

export const registrationRoutes = new Elysia({ name: 'registration' })
  /* ---------- police ---------- */

  .post(
    '/register',
    async ({ body, request }) => {
      rateLimit(clientKey(request, 'submit'), SUBMIT_LIMIT, SUBMIT_WINDOW_MS);
      const errors = validatePolice(body);
      if (errors.length) reject(errors);

      await refuseDuplicate(request, body.discordId, findPendingMessageId);

      const data = {
        ocName: body.ocName.trim(),
        icName: body.icName.trim(),
        ocAge: body.ocAge,
        icPhone: body.icPhone.trim(),
        discordId: body.discordId.trim(),
        steamUrl: body.steamUrl.trim(),
      };

      const messageId = await sendRegistration(data);

      // The sheet copy is a convenience for reviewers; Discord is the record
      // of truth, so a sheet failure must not fail the registration.
      try {
        await addPendingRegistration({
          discordId: data.discordId,
          discordName: body.discordDisplayName || data.ocName,
          icName: data.icName,
          icPhone: data.icPhone,
          ocAge: data.ocAge,
          steamUrl: data.steamUrl,
          messageId,
        });
      } catch (err) {
        console.error('[register] pending sheet write failed:', (err as Error).message);
      }

      return {
        success: true,
        message: 'สมัครสำเร็จ! ข้อมูลถูกส่งไปยังทีมงานแล้ว',
        messageId,
      };
    },
    { body: policeBody }
  )

  .patch(
    '/register/edit',
    async ({ body, request }) => {
      rateLimit(clientKey(request, 'edit'), EDIT_LIMIT, EDIT_WINDOW_MS);
      const verifiedUserId = requireDiscordUser(request);

      if (!body.messageId) throw new ApiError('กรุณาระบุ Message ID', 400);
      if (!body.discordId) throw new ApiError('กรุณาเชื่อมต่อ Discord ก่อนแก้ไขข้อมูล', 400);

      const errors = validatePolice(body);
      if (errors.length) reject(errors);

      const editCount = (body.editCount ?? 0) + 1;

      await editRegistration(
        body.messageId,
        {
          ocName: body.ocName.trim(),
          icName: body.icName.trim(),
          ocAge: body.ocAge,
          icPhone: body.icPhone.trim(),
          discordId: body.discordId.trim(),
          steamUrl: body.steamUrl.trim(),
        },
        editCount,
        verifiedUserId
      );

      try {
        await updatePendingRegistration(body.discordId.trim(), {
          icName: body.icName.trim(),
          icPhone: body.icPhone.trim(),
          ocAge: body.ocAge,
          steamUrl: body.steamUrl.trim(),
        });
      } catch (err) {
        console.error('[register] pending sheet update failed:', (err as Error).message);
      }

      return { success: true, message: 'แก้ไขข้อมูลสำเร็จ! Embed ใน Discord อัปเดตแล้ว', editCount };
    },
    {
      body: t.Composite([
        policeBody,
        t.Object({ messageId: t.String(), editCount: t.Optional(t.Numeric()) }),
      ]),
    }
  )

  /* The application belonging to whoever is signed in, without their having
     to know its Discord message id. The id is found from the sheet by the id
     in the session cookie, so this can only ever reach the caller's own
     submission — the ownership check inside fetchRegistration then still runs,
     because a row is a weaker claim than the message itself. */
  .get('/register/mine', async ({ request }) => {
    rateLimit(clientKey(request, 'edit'), EDIT_LIMIT, EDIT_WINDOW_MS);
    const verifiedUserId = requireDiscordUser(request);

    const messageId = await findPendingMessageId(verifiedUserId);
    if (!messageId) {
      throw new ApiError(
        'ไม่พบใบสมัครของบัญชี Discord นี้ — ใบที่สมัครไว้ก่อนระบบนี้จะยังไม่มีข้อมูลผูกไว้ กรุณากรอก Message ID เอง',
        404
      );
    }

    return fetchRegistration(messageId, verifiedUserId);
  })

  .get(
    '/register/fetch/:messageId',
    async ({ params, request }) => {
      rateLimit(clientKey(request, 'edit'), EDIT_LIMIT, EDIT_WINDOW_MS);
      const result = await fetchRegistration(params.messageId, requireDiscordUser(request));
      return { success: true, ...result };
    },
    {
      params: t.Object({ messageId: t.String() }),
      query: t.Object({ discordUserId: t.Optional(t.String()) }),
    }
  )

  /* ---------- medical ---------- */

  .post(
    '/medical',
    async ({ body, request }) => {
      rateLimit(clientKey(request, 'submit'), SUBMIT_LIMIT, SUBMIT_WINDOW_MS);
      const errors = validateMedical(body);
      if (errors.length) reject(errors);

      await refuseDuplicate(request, body.discordId, findMedicalMessageId);

      const data = {
        icName: body.icName.trim(),
        ocAge: body.ocAge,
        timeStart: body.timeStart.trim(),
        timeEnd: body.timeEnd.trim(),
        medicalExperience: body.medicalExperience.trim(),
        joinReason: body.joinReason.trim(),
        discordId: body.discordId.trim(),
      };

      const messageId = await sendMedical(data);

      // Same bargain as the police sheet: Discord is the record of truth, so a
      // sheet failure must not fail the application.
      try {
        await addMedicalApplication({
          ...data,
          discordName: body.discordDisplayName || '',
          messageId,
        });
      } catch (err) {
        console.error('[medical] sheet write failed:', (err as Error).message);
      }

      return {
        success: true,
        message: 'สมัครสำเร็จ! ข้อมูลถูกส่งไปยังทีมงานแล้ว',
        messageId,
      };
    },
    { body: medicalBody }
  )

  .patch(
    '/medical/edit',
    async ({ body, request }) => {
      rateLimit(clientKey(request, 'edit'), EDIT_LIMIT, EDIT_WINDOW_MS);
      const verifiedUserId = requireDiscordUser(request);

      if (!body.messageId) throw new ApiError('กรุณาระบุ Message ID', 400);
      if (!body.discordId) throw new ApiError('กรุณาเชื่อมต่อ Discord ก่อนแก้ไขข้อมูล', 400);

      const errors = validateMedical(body);
      if (errors.length) reject(errors);

      const editCount = (body.editCount ?? 0) + 1;

      await editMedical(
        body.messageId,
        {
          icName: body.icName.trim(),
          ocAge: body.ocAge,
          timeStart: body.timeStart.trim(),
          timeEnd: body.timeEnd.trim(),
          medicalExperience: body.medicalExperience.trim(),
          joinReason: body.joinReason.trim(),
          discordId: body.discordId.trim(),
        },
        editCount,
        verifiedUserId
      );

      // Best-effort, as on submit: the embed is already updated.
      try {
        await updateMedicalApplication(verifiedUserId, {
          icName: body.icName.trim(),
          ocAge: body.ocAge,
          timeStart: body.timeStart.trim(),
          timeEnd: body.timeEnd.trim(),
          medicalExperience: body.medicalExperience.trim(),
          joinReason: body.joinReason.trim(),
        });
      } catch (err) {
        console.error('[medical] sheet update failed:', (err as Error).message);
      }

      return { success: true, message: 'แก้ไขข้อมูลสำเร็จ! Embed ใน Discord อัปเดตแล้ว', editCount };
    },
    {
      body: t.Composite([
        medicalBody,
        t.Object({ messageId: t.String(), editCount: t.Optional(t.Numeric()) }),
      ]),
    }
  )

  /* The medical application belonging to whoever is signed in — the same
     lookup /register/mine does, against the other sheet. */
  .get('/medical/mine', async ({ request }) => {
    rateLimit(clientKey(request, 'edit'), EDIT_LIMIT, EDIT_WINDOW_MS);
    const verifiedUserId = requireDiscordUser(request);

    const messageId = await findMedicalMessageId(verifiedUserId);
    if (!messageId) {
      throw new ApiError(
        'ไม่พบใบสมัครของบัญชี Discord นี้ — ใบที่สมัครไว้ก่อนระบบนี้จะยังไม่มีข้อมูลผูกไว้ กรุณากรอก Message ID เอง',
        404
      );
    }

    return fetchMedical(messageId, verifiedUserId);
  })

  .get(
    '/medical/fetch/:messageId',
    async ({ params, request }) => {
      rateLimit(clientKey(request, 'edit'), EDIT_LIMIT, EDIT_WINDOW_MS);
      const result = await fetchMedical(params.messageId, requireDiscordUser(request));
      return { success: true, ...result };
    },
    {
      params: t.Object({ messageId: t.String() }),
      query: t.Object({ discordUserId: t.Optional(t.String()) }),
    }
  );
