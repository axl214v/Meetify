'use strict';
const path = require('path');
const fs   = require('fs');
const db   = require('../config/database');
const { ZipArchive } = require('archiver');

const BACKUPS_DIR = path.join(__dirname, '..', 'backups');

// ── SQL dump ────────────────────────────────────────────────────────────────
async function generateSqlDump() {
    let sql = `-- Meetify Database Backup\n-- Created: ${new Date().toISOString()}\n\nSET FOREIGN_KEY_CHECKS=0;\n\n`;
    const [tableRows] = await db.promise().query('SHOW TABLES');
    const tables = tableRows.map(r => Object.values(r)[0]);

    for (const table of tables) {
        const [[createRow]] = await db.promise().query(`SHOW CREATE TABLE \`${table}\``);
        sql += `-- Table: ${table}\nDROP TABLE IF EXISTS \`${table}\`;\n${createRow['Create Table']};\n\n`;

        const [rows] = await db.promise().query(`SELECT * FROM \`${table}\``);
        if (!rows.length) continue;

        const cols = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
        const vals = rows.map(row =>
            '(' + Object.values(row).map(v => {
                if (v === null) return 'NULL';
                if (typeof v === 'boolean') return v ? '1' : '0';
                if (typeof v === 'number') return String(v);
                if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
                if (Buffer.isBuffer(v)) return `X'${v.toString('hex')}'`;
                return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
            }).join(', ') + ')'
        ).join(',\n');
        sql += `INSERT INTO \`${table}\` (${cols}) VALUES\n${vals};\n\n`;
    }
    sql += 'SET FOREIGN_KEY_CHECKS=1;\n';
    return sql;
}

// ── Archive builder (shared) ─────────────────────────────────────────────────
async function buildIntoArchive(archive) {
    const sql = await generateSqlDump();
    archive.append(sql, { name: 'database.sql' });
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadsDir)) archive.directory(uploadsDir, 'uploads');
    return archive.finalize();
}

// ── Stream directly to HTTP response ────────────────────────────────────────
async function streamToResponse(res) {
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="meetify-backup-${date}.zip"`);
    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on('error', err => { if (!res.headersSent) res.status(500).json({ error: err.message }); });
    archive.pipe(res);
    await buildIntoArchive(archive);
}

// ── Save to local file ───────────────────────────────────────────────────────
function ensureBackupsDir() {
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

async function saveToFile(filename) {
    ensureBackupsDir();
    const filepath = path.join(BACKUPS_DIR, filename);
    return new Promise((resolve, reject) => {
        const archive = new ZipArchive({ zlib: { level: 6 } });
        const out = fs.createWriteStream(filepath);
        archive.on('error', reject);
        out.on('close', () => resolve({ filename, size: out.bytesWritten }));
        archive.pipe(out);
        buildIntoArchive(archive).catch(reject);
    });
}

// ── Upload via SFTP ─────────────────────────────────────────────────────────
async function saveToSftp(filename, sshConfig) {
    const SftpClient = require('ssh2-sftp-client');
    ensureBackupsDir();
    const tempPath = path.join(BACKUPS_DIR, `_tmp_${filename}`);

    await new Promise((resolve, reject) => {
        const archive = new ZipArchive({ zlib: { level: 6 } });
        const out = fs.createWriteStream(tempPath);
        archive.on('error', reject);
        out.on('close', resolve);
        archive.pipe(out);
        buildIntoArchive(archive).catch(reject);
    });

    const sftp = new SftpClient();
    try {
        await sftp.connect({
            host:     sshConfig.host,
            port:     parseInt(sshConfig.port) || 22,
            username: sshConfig.user,
            password: sshConfig.password,
        });
        const remote = (sshConfig.remotePath || '/').replace(/\/$/, '') + '/' + filename;
        await sftp.put(tempPath, remote);
    } finally {
        await sftp.end().catch(() => {});
        fs.unlink(tempPath, () => {});
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeFilename() {
    return `meetify-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.zip`;
}

async function getHistory() {
    if (!fs.existsSync(BACKUPS_DIR)) return [];
    return fs.readdirSync(BACKUPS_DIR)
        .filter(f => f.endsWith('.zip') && !f.startsWith('_tmp_'))
        .map(f => {
            const stat = fs.statSync(path.join(BACKUPS_DIR, f));
            return { filename: f, size: stat.size, createdAt: stat.mtime.toISOString() };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function deleteBackup(filename) {
    const filepath = path.join(BACKUPS_DIR, path.basename(filename));
    if (!filepath.startsWith(BACKUPS_DIR)) throw new Error('Invalid filename');
    if (!fs.existsSync(filepath)) throw new Error('File not found');
    fs.unlinkSync(filepath);
}

// ── Settings in app_settings ─────────────────────────────────────────────────
function defaultSettings() {
    return {
        schedule:    'off',
        scheduleHour: 2,
        scheduleDay:  0,
        destination: 'local',
        ssh: { host: '', port: 22, user: '', password: '', remotePath: '/backups' },
    };
}

async function getSettings() {
    const [[row]] = await db.promise().query(
        "SELECT value FROM app_settings WHERE `key` = 'backup_config'"
    );
    if (!row) return defaultSettings();
    try { return { ...defaultSettings(), ...JSON.parse(row.value) }; } catch { return defaultSettings(); }
}

async function saveSettings(settings) {
    const val = JSON.stringify(settings);
    await db.promise().query(
        "INSERT INTO app_settings (`key`, value) VALUES ('backup_config', ?) ON DUPLICATE KEY UPDATE value = ?",
        [val, val]
    );
}

module.exports = {
    streamToResponse, saveToFile, saveToSftp,
    makeFilename, getHistory, deleteBackup,
    getSettings, saveSettings, defaultSettings,
};
