/* Environment configuration — read once per serverless instance */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  get SHEET_ID() {
    return required('SHEET_ID');
  },
  get CASES_SHEET_ID() {
    return required('CASES_SHEET_ID');
  },
  get RULES_SHEET_ID() {
    return required('RULES_SHEET_ID');
  },
  get ADMIN_PIN() {
    return required('ADMIN_PIN');
  },

  CASES_DATA_SHEET_ID:
    process.env.CASES_DATA_SHEET_ID || '1grpNtG3sa9UoSwmTU3tY7-FOZQEHcMvL-Vu_1ipULlI',

  /* Both fall back to SHEET_ID, but through the getter above rather than
     process.env directly: an empty string here reaches Google as a request
     for the spreadsheet named "", which comes back as a 404 that says
     nothing about what is actually wrong. Going through required() names
     the missing variable instead. */
  get PENDING_SPREADSHEET_ID() {
    return process.env.PENDING_SPREADSHEET_ID || this.SHEET_ID;
  },
  get ROSTER_SHEET_ID() {
    return process.env.ROSTER_SHEET_ID || this.SHEET_ID;
  },

  SHEET_NAME: 'NamePD',
  CASES_SHEET_NAME: 'CaseAll',
  CONDUCT_SHEET_NAME: 'conduct',
  RULES_SHEET_NAME: 'rules',
  FINES_SHEET_NAME: 'fines',
  PENDING_SHEET_NAME: process.env.PENDING_SHEET_NAME || 'Pending',
  MEDICAL_SHEET_NAME: process.env.MEDICAL_SHEET_NAME || 'Medical',
  ROSTER_SHEET_NAME: 'NamePD',
  ROSTER_OUT_SHEET_NAME: 'OutDC',

  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || '',
  DISCORD_REGISTER_WEBHOOK_URL: process.env.DISCORD_REGISTER_WEBHOOK_URL || '',
  DISCORD_MEDICAL_WEBHOOK_URL: process.env.DISCORD_MEDICAL_WEBHOOK_URL || '',
  DISCORD_PROCTOR_WEBHOOK_URL: process.env.DISCORD_PROCTOR_WEBHOOK_URL || '',
  DISCORD_OUTPD_WEBHOOK_URL: process.env.DISCORD_OUTPD_WEBHOOK_URL || '',

/* Standby ids for the two Discord allowlists, merged with the lists the
     sheets hold in NamePD!AB2 and Pending!J1. Normally empty: the sheet is
     where access is granted. They exist so a mistyped key cell or an inserted
     row cannot lock the last admin out of the page that edits that sheet. */
  ROSTERMANAGE_IDDC: process.env.ROSTERMANAGE_IDDC || '',
  PROCTOR_IDDC: process.env.PROCTOR_IDDC || '',

  APP_URL: process.env.APP_URL || 'http://localhost:3000',

  CACHE_TTL: 15_000,
  REQUEST_TIMEOUT: 10_000,
} as const;
