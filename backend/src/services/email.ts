import nodemailer from 'nodemailer';
import { config } from '../config';

class EmailService {
    private transporter;

    constructor() {
        // Initialize transporter only if SMTP config is provided
        if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS) {
            this.transporter = nodemailer.createTransport({
                host: config.SMTP_HOST,
                port: config.SMTP_PORT || 587,
                secure: config.SMTP_PORT === 465,
                auth: {
                    user: config.SMTP_USER,
                    pass: config.SMTP_PASS,
                },
            });
        }
    }

    async sendEmail(to: string, subject: string, text: string, html?: string) {
        if (!this.transporter) {
            console.warn(`[EMAIL MOCK] No SMTP config. Printing email to console:`);
            console.log(`To: ${to}`);
            console.log(`Subject: ${subject}`);
            console.log(`Body: ${text}`);
            return;
        }

        try {
            await this.transporter.sendMail({
                from: config.SMTP_FROM,
                to,
                subject,
                text,
                html: html || text,
            });
            console.log(`[EMAIL] Sent successfully to ${to}`);
        } catch (error) {
            console.error(`[EMAIL ERROR] Failed to send to ${to}:`, error);
            throw error;
        }
    }

    async sendTemporaryPassword(to: string, tempPassword: string) {
        const subject = 'Your Temporary Password - MerchCrafter';
        const text = `Hello,\n\nA password reset was requested for your MerchCrafter account. Your temporary password is: ${tempPassword}\n\nPlease login and change your password immediately in Settings.\n\nBest,\nMerchCrafter Team`;
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: #4f46e5;">MerchCrafter Password Recovery</h2>
                <p>Hello,</p>
                <p>A password reset was requested for your account. Use the temporary password below to log in:</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; border: 1px solid #e5e7eb;">
                    ${tempPassword}
                </div>
                <p><strong>Note:</strong> Please log in and change your password immediately in your account settings.</p>
                <p>If you did not request this, you can safely ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 12px; color: #6b7280;">MerchCrafter - The Ultimate Prompt-to-Merch Platform</p>
            </div>
        `;
        await this.sendEmail(to, subject, text, html);
    }
}

export const emailService = new EmailService();
