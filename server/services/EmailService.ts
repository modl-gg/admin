import nodemailer from 'nodemailer';
import crypto from 'crypto';
import mongoose, { Schema, model, Document, Model } from 'mongoose';
import { IEmailCode as IEmailCodeShared, EmailCodeSchema } from 'modl-shared-web';
import 'dotenv/config';

type IEmailCode = IEmailCodeShared & Document;

const getEmailCodeModel = (): Model<IEmailCode> => {
  return mongoose.models.EmailCode as Model<IEmailCode> || mongoose.model<IEmailCode>('EmailCode', EmailCodeSchema);
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '25'),
      secure: false, // Use TLS
      auth: undefined, // No auth for local postfix
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  /**
   * Generate a 6-digit random code
   */
  private generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Send verification code to admin email
   */
  async sendVerificationCode(email: string): Promise<string> {
    try {
      const EmailCodeModel = getEmailCodeModel();
      // Generate new code
      const code = this.generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Invalidate any existing unused codes for this email
      await EmailCodeModel.updateMany(
        { email, used: false },
        { used: true }
      );

      // Save new code
      await new EmailCodeModel({
        email,
        code,
        expiresAt,
        used: false
      }).save();

      // Send email
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@modl.gg',
        to: email,
        subject: 'modl Admin Login Code',
        text: `Your login code is: ${code}\n\nThis code will expire in 10 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #333;">modl Admin Login</h2>
            <p>Your login code is:</p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">
              ${code}
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
            <p style="color: #666; font-size: 12px;">If you did not request this code, please ignore this email.</p>
          </div>
        `
      });

      return code;
    } catch (error) {
      console.error('Failed to send verification code:', error);
      throw new Error('Failed to send verification code');
    }
  }

  /**
   * Verify the provided code
   */
  async verifyCode(email: string, code: string): Promise<boolean> {
    try {
      const EmailCodeModel = getEmailCodeModel();
      const emailCode = await EmailCodeModel.findOne({
        email,
        code,
        used: false,
        expiresAt: { $gt: new Date() }
      });

      if (!emailCode) {
        return false;
      }

      // Mark code as used
      emailCode.used = true;
      await emailCode.save();

      return true;
    } catch (error) {
      console.error('Failed to verify code:', error);
      return false;
    }
  }
}

export default new EmailService(); 