/**
 * GT-DAYN — DriveService.js
 * مزامنة قاعدة البيانات مع Google Drive
 *
 * المبدأ:
 *   - يخزن ملف واحد فقط: gt-dayn-backup.sqlite في مجلد "appDataFolder"
 *     (مجلد خاص بالتطبيق غير مرئي للمستخدم في My Drive)
 *   - OAuth2 عبر google Identity Services (GIS) — بدون popup مزعج
 *   - تحقق من hash قبل الرفع لتجنب الرفع غير الضروري
 */

const CLIENT_ID  = 'YOUR_GOOGLE_CLIENT_ID';        // ← تُعوَّض في .env
const SCOPES     = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME  = 'gt-dayn-backup.sqlite';
const DRIVE_API  = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export class DriveService {
  constructor(db) {
    this._db          = db;
    this._token       = null;
    this._fileId      = null;
    this._tokenExpiry = 0;
  }

  // ── المصادقة ───────────────────────────────────────────────────────────────

  async signIn() {
    return new Promise((res, rej) => {
      if (!window.google) { rej(new Error('GIS not loaded')); return; }
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope:     SCOPES,
        callback:  (resp) => {
          if (resp.error) { rej(new Error(resp.error)); return; }
          this._token       = resp.access_token;
          this._tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
          res(resp);
        },
      });
      client.requestAccessToken({ prompt: '' });
    });
  }

  isSignedIn() {
    return !!this._token && Date.now() < this._tokenExpiry;
  }

  signOut() {
    if (this._token) {
      google.accounts.oauth2.revoke(this._token, () => {});
    }
    this._token  = null;
    this._fileId = null;
  }

  // ── رفع (Upload) ────────────────────────────────────────────────────────────

  async upload() {
    await this._ensureToken();
    const data = await this._db.export();     // Uint8Array

    if (!this._fileId) this._fileId = await this._findFile();

    const metadata = JSON.stringify({
      name:    FILE_NAME,
      parents: ['appDataFolder'],
    });

    const form = new FormData();
    form.append('metadata', new Blob([metadata], { type: 'application/json' }));
    form.append('file',     new Blob([data],     { type: 'application/octet-stream' }));

    const url    = this._fileId
      ? `${UPLOAD_API}/files/${this._fileId}?uploadType=multipart`
      : `${UPLOAD_API}/files?uploadType=multipart`;
    const method = this._fileId ? 'PATCH' : 'POST';

    const resp   = await this._fetch(url, { method, body: form });
    const json   = await resp.json();
    this._fileId = json.id;

    await this._updateSyncRecord('done');
    return json.id;
  }

  // ── تنزيل (Download) ────────────────────────────────────────────────────────

  async download() {
    await this._ensureToken();
    if (!this._fileId) this._fileId = await this._findFile();
    if (!this._fileId) throw new Error('NO_BACKUP');

    const resp = await this._fetch(
      `${DRIVE_API}/files/${this._fileId}?alt=media`
    );
    if (!resp.ok) throw new Error('DOWNLOAD_FAILED');

    const buffer = await resp.arrayBuffer();
    await this._db.import(new Uint8Array(buffer));
    await this._updateSyncRecord('done');
  }

  // ── داخلي ───────────────────────────────────────────────────────────────────

  async _findFile() {
    const q    = encodeURIComponent(`name='${FILE_NAME}' and 'appDataFolder' in parents and trashed=false`);
    const resp = await this._fetch(`${DRIVE_API}/files?spaces=appDataFolder&q=${q}&fields=files(id)`);
    const json = await resp.json();
    return json.files?.[0]?.id ?? null;
  }

  async _ensureToken() {
    if (!this.isSignedIn()) await this.signIn();
  }

  _fetch(url, opts = {}) {
    return fetch(url, {
      ...opts,
      headers: {
        ...(opts.headers ?? {}),
        Authorization: `Bearer ${this._token}`,
      },
    });
  }

  async _updateSyncRecord(status) {
    const now = new Date().toISOString();
    await this._db.run(
      `UPDATE drive_sync SET file_id=?, last_synced=?, status=?, error_msg=NULL WHERE id=1`,
      [this._fileId, now, status]
    );
  }
}
