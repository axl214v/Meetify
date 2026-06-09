'use strict';
const cron   = require('node-cron');
const backup = require('./backupService');
const log    = (msg) => console.log(`[Backup] ${msg}`);
const warn   = (msg) => console.error(`[Backup] ${msg}`);

let currentTask = null;

function toCronExpr(settings) {
    const h = Math.max(0, Math.min(23, parseInt(settings.scheduleHour) || 0));
    const d = Math.max(0, Math.min(6,  parseInt(settings.scheduleDay)  || 0));
    switch (settings.schedule) {
        case 'hourly': return '0 * * * *';
        case 'daily':  return `0 ${h} * * *`;
        case 'weekly': return `0 ${h} * * ${d}`;
        default:       return null;
    }
}

async function runJob(settings) {
    const filename = backup.makeFilename();
    log(`[Backup] Scheduled run → dest=${settings.destination} file=${filename}`);
    try {
        if (settings.destination === 'ssh') {
            await backup.saveToSftp(filename, settings.ssh);
        } else {
            await backup.saveToFile(filename);
        }
        log(`[Backup] Done: ${filename}`);
    } catch (err) {
        warn(`[Backup] Failed: ${err.message}`);
    }
}

async function reschedule() {
    if (currentTask) { currentTask.stop(); currentTask = null; }
    try {
        const settings = await backup.getSettings();
        const expr = toCronExpr(settings);
        if (!expr) { log('[Backup] Scheduler off'); return; }
        currentTask = cron.schedule(expr, () => runJob(settings));
        log(`[Backup] Scheduled ${settings.schedule} (${expr}) → ${settings.destination}`);
    } catch (err) {
        warn(`[Backup] Scheduler error: ${err.message}`);
    }
}

module.exports = { init: reschedule, reschedule };
