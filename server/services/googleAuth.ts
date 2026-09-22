/* Google Sheets client — one instance per serverless container */

import { google, type sheets_v4 } from 'googleapis';

let client: sheets_v4.Sheets | null = null;

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function parseKey(rawKey: string): Record<string, unknown> {
  try {
    return JSON.parse(rawKey);
  } catch {
    throw new Error('GOOGLE_JSON_KEY is not valid JSON');
  }
}

/* The service account arrives one of two ways: GOOGLE_JSON_KEY carrying the
   whole JSON on a single line, or GOOGLE_APPLICATION_CREDENTIALS carrying a
   path to that JSON on disk — GoogleAuth reads that variable itself. The file
   form exists because hosting panels mangle a 2 KB value set through their own
   UI: DirectAdmin writes it into .htaccess as a SetEnv line, where the value
   stops at the first space, and the app then reports "not valid JSON". */
export function getSheets(): sheets_v4.Sheets {
  if (client) return client;

  const rawKey = process.env.GOOGLE_JSON_KEY;

  if (!rawKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      'Set GOOGLE_JSON_KEY to the service-account JSON, or GOOGLE_APPLICATION_CREDENTIALS to its path'
    );
  }

  const auth = new google.auth.GoogleAuth(
    rawKey ? { credentials: parseKey(rawKey), scopes: SCOPES } : { scopes: SCOPES }
  );

  client = google.sheets({ version: 'v4', auth });
  return client;
}
