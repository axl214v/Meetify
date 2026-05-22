const nodemailer = require('nodemailer');
const db = require('../config/database');

class EmailService {

    // Загрузить SMTP настройки из БД
    static async getSmtpSettings() {
        const [rows] = await db.promise().query(
            'SELECT `key`, value FROM app_settings WHERE `key` LIKE "smtp_%"'
        );
        return rows.reduce((acc, row) => {
            acc[row.key] = row.value;
            return acc;
        }, {});
    }

    // Создать транспорт с текущими настройками
    static async createTransport() {
        const s = await EmailService.getSmtpSettings();

        if (s.smtp_enabled !== 'true') return null;
        if (!s.smtp_user || !s.smtp_password) return null;

        return nodemailer.createTransport({
            host:   s.smtp_host,
            port:   parseInt(s.smtp_port) || 587,
            secure: s.smtp_secure === 'true',
            auth: {
                user: s.smtp_user,
                pass: s.smtp_password
            }
        });
    }

    // Отправить письмо
    static async send({ to, subject, html }) {
        try {
            const s = await EmailService.getSmtpSettings();

            if (s.smtp_enabled !== 'true' || !s.smtp_user || !s.smtp_password) {
                console.log('[Email] SMTP disabled or not configured — skipping send');
                return { sent: false, reason: 'smtp_disabled' };
            }

            const transport = nodemailer.createTransport({
                host:   s.smtp_host,
                port:   parseInt(s.smtp_port) || 587,
                secure: s.smtp_secure === 'true',
                auth:   { user: s.smtp_user, pass: s.smtp_password }
            });

            await transport.sendMail({
                from: s.smtp_from || 'Meetify <noreply@meetify.com>',
                to,
                subject,
                html
            });

            console.log(`[Email] Sent "${subject}" to ${to}`);
            return { sent: true };

        } catch (error) {
            console.error('[Email] Send error:', error.message);
            return { sent: false, reason: error.message };
        }
    }

    // Верификационное письмо
    static async sendVerificationEmail(user, token) {
        const config = require('../config/config');
        const link = `${config.client.url}/auth/verify-email.html?token=${token}`;

        return EmailService.send({
            to: user.email,
            subject: 'Verify your Meetify email',
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0d1220;color:#f1f5f9;border-radius:12px">
                    <h2 style="color:#60a5fa;margin-bottom:8px">Welcome to Meetify</h2>
                    <p style="color:#94a3b8;margin-bottom:24px">Please verify your email address to access all features.</p>
                    <a href="${link}" style="display:inline-block;padding:12px 28px;background:#3b82f6;color:#fff;
                        text-decoration:none;border-radius:8px;font-weight:600">Verify Email</a>
                    <p style="color:#475569;font-size:12px;margin-top:24px">
                        Link expires in 24 hours. If you didn't register, ignore this email.
                    </p>
                </div>
            `
        });
    }

    // Письмо со ссылкой для сброса пароля
    static async sendPasswordResetEmail(user, resetLink) {
        return EmailService.send({
            to: user.email,
            subject: 'Reset your Meetify password',
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0d1220;color:#f1f5f9;border-radius:12px">
                    <h2 style="color:#60a5fa;margin-bottom:8px">Password Reset</h2>
                    <p style="color:#94a3b8;margin-bottom:8px">We received a request to reset the password for your Meetify account.</p>
                    <p style="color:#94a3b8;margin-bottom:24px">Click the button below to set a new password:</p>
                    <a href="${resetLink}" style="display:inline-block;padding:12px 28px;background:#3b82f6;color:#fff;
                        text-decoration:none;border-radius:8px;font-weight:600">Reset Password</a>
                    <p style="color:#475569;font-size:12px;margin-top:24px">
                        This link expires in <strong style="color:#94a3b8">1 hour</strong>.
                        If you didn't request a password reset, you can safely ignore this email.
                    </p>
                </div>
            `
        });
    }

    // Тест SMTP соединения
    static async testConnection(settings) {
        try {
            const transport = nodemailer.createTransport({
                host:   settings.smtp_host,
                port:   parseInt(settings.smtp_port) || 587,
                secure: settings.smtp_secure === 'true',
                auth: {
                    user: settings.smtp_user,
                    pass: settings.smtp_password
                }
            });

            await transport.verify();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = EmailService;