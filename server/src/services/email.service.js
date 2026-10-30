const nodemailer = require('nodemailer');

class EmailService {
  /**
   * Create configured Nodemailer transporter.
   * @returns {object} Nodemailer transporter instance
   */
  static getTransporter() {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'sandbox.smtp.mailtrap.io',
      port: Number(process.env.EMAIL_PORT) || 2525,
      auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000,
    });
  }

  /**
   * Send 6-digit email verification code.
   * @param {string} to - Recipient email address
   * @param {string} code - 6-digit verification code
   * @returns {Promise<object>} Nodemailer send result
   */
  static async sendVerificationCodeEmail(to, code) {
    const from = process.env.EMAIL_FROM || 'noreply@pizzaapp.dev';

    // Never log verification codes in production
    if (process.env.NODE_ENV === 'development') {
      console.log(`[EmailService] Verification code for ${to}: ${code}`);
    }

    const mailOptions = {
      from,
      to,
      subject: 'Your Verification Code — Dough & Co.',
      text: `Welcome to Dough & Co.! Your 6-digit email verification code is: ${code}\nThis code will expire in 15 minutes. If you did not create an account, please ignore this email.`,
      html: `
        <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background-color: #faf7f2; border-radius: 16px; border: 1px solid #e7e5e4;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #c2410c; margin: 0; font-size: 26px; font-weight: 800;">Dough &amp; Co.</h1>
            <p style="color: #78716c; font-size: 13px; margin-top: 4px;">Artisan Pizza Delivery</p>
          </div>
          <div style="background-color: #ffffff; padding: 28px; border-radius: 12px; border: 1px solid #e7e5e4; text-align: center;">
            <h2 style="color: #1c1917; margin-top: 0; font-size: 20px;">Verify Your Email Address</h2>
            <p style="color: #57534e; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
              Thank you for signing up! Enter the 6-digit verification code below to activate your account:
            </p>
            <div style="background-color: #f5f5f4; border: 2px dashed #c2410c; border-radius: 12px; padding: 18px 24px; display: inline-block; margin-bottom: 24px;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #c2410c; font-family: monospace;">${code}</span>
            </div>
            <p style="color: #78716c; font-size: 12px; line-height: 1.5; margin: 0;">
              This code will expire in <strong>15 minutes</strong>.<br />
              If you didn't create an account with Dough &amp; Co., you can safely ignore this email.
            </p>
          </div>
          <p style="text-align: center; color: #a8a29e; font-size: 11px; margin-top: 24px;">
            &copy; ${new Date().getFullYear()} Dough &amp; Co. Pizza Delivery. All rights reserved.
          </p>
        </div>
      `,
    };

    const transporter = EmailService.getTransporter();
    return transporter.sendMail(mailOptions);
  }

  /**
   * Send account verification email with raw token (backward compatibility).
   * @param {string} to - Recipient email address
   * @param {string} rawToken - Raw UUID verification token or 6-digit code
   * @returns {Promise<object>} Nodemailer send result
   */
  static async sendVerificationEmail(to, rawToken) {
    if (typeof rawToken === 'string' && /^\d{6}$/.test(rawToken.trim())) {
      return EmailService.sendVerificationCodeEmail(to, rawToken);
    }
    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const verificationUrl = `${clientOrigin}/verify-email?token=${rawToken}`;
    const from = process.env.EMAIL_FROM || 'noreply@pizzaapp.dev';

    const mailOptions = {
      from,
      to,
      subject: 'Verify Your Email — Pizza Delivery App',
      text: `Welcome to Pizza Delivery App! Please verify your email by clicking the link: ${verificationUrl}\nThis link expires in 24 hours.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #E63946;">Welcome to Pizza Delivery App!</h2>
          <p>Thank you for registering. Please click the button below to verify your email address:</p>
          <p style="margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #E63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p><a href="${verificationUrl}">${verificationUrl}</a></p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">This link will expire in 24 hours. If you did not create an account, please ignore this email.</p>
        </div>
      `,
    };

    const transporter = EmailService.getTransporter();
    return transporter.sendMail(mailOptions);
  }

  /**
   * Send password reset email with raw token.
   * @param {string} to - Recipient email address
   * @param {string} rawToken - Raw UUID reset token
   * @returns {Promise<object>} Nodemailer send result
   */
  static async sendPasswordResetEmail(to, rawToken) {
    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const resetUrl = `${clientOrigin}/reset-password?token=${rawToken}`;
    const from = process.env.EMAIL_FROM || 'noreply@pizzaapp.dev';

    const mailOptions = {
      from,
      to,
      subject: 'Password Reset Request — Pizza Delivery App',
      text: `You requested a password reset. Please click the link to choose a new password: ${resetUrl}\nThis link expires in 1 hour.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #E63946;">Password Reset Request</h2>
          <p>We received a request to reset your password. Click the button below to set a new password:</p>
          <p style="margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #E63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">This link will expire in 1 hour. If you did not request a password reset, please ignore this email.</p>
        </div>
      `,
    };

    const transporter = EmailService.getTransporter();
    return transporter.sendMail(mailOptions);
  }

  /**
   * Send compensating alert email to administrator when an inventory decrement
   * fails in degraded fallback mode (standalone MongoDB / no transaction support).
   * Plan Reference: project_plan.md §9.7
   * @param {object} details - { orderId, optionId, reason }
   * @returns {Promise<object>} Nodemailer send result
   */
  static async sendInventoryFailureAlert({ orderId, optionId, reason }) {
    let adminEmail = process.env.ADMIN_ALERT_EMAIL;
    if (!adminEmail || adminEmail.trim() === '') {
      console.warn(
        '[EmailService] ADMIN_ALERT_EMAIL is not configured. Falling back to admin@pizzaapp.dev',
      );
      adminEmail = 'admin@pizzaapp.dev';
    }
    const from = process.env.EMAIL_FROM || 'noreply@pizzaapp.dev';

    const mailOptions = {
      from,
      to: adminEmail,
      subject: `[ALERT] Compensating Fallback Inventory Failure on Order ${orderId}`,
      text: `Compensating Fallback Inventory Alert:\n\nOrder ID: ${orderId}\nFailed Option ID: ${optionId}\nReason: ${reason}\n\nPlease review inventory manually. The customer payment was processed and the order remains confirmed per §9.7.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #D90429;">Compensating Fallback Inventory Alert</h2>
          <p>An inventory decrement write failed during degraded sequenced fallback on confirmed order:</p>
          <ul>
            <li><strong>Order ID:</strong> ${orderId}</li>
            <li><strong>Option ID:</strong> ${optionId}</li>
            <li><strong>Reason:</strong> ${reason}</li>
          </ul>
          <p>The order remains marked as paid because payment was processed. Please reconcile inventory manually.</p>
        </div>
      `,
    };

    const transporter = EmailService.getTransporter();
    return transporter.sendMail(mailOptions);
  }

  /**
   * Send aggregated low-stock alert email to administrator.
   * Plan Reference: project_plan.md §4.2 (FR-A06), §10.5, §17.3
   * @param {Array<object>} items - List of inventory items below their threshold
   * @returns {Promise<object>} Nodemailer send result
   */
  static async sendLowStockAlert(items) {
    if (!items || items.length === 0) {
      return null;
    }

    let adminEmail = process.env.ADMIN_ALERT_EMAIL;
    if (!adminEmail || adminEmail.trim() === '') {
      console.warn(
        '[EmailService] ADMIN_ALERT_EMAIL is not configured. Falling back to admin@pizzaapp.dev',
      );
      adminEmail = 'admin@pizzaapp.dev';
    }
    const from = process.env.EMAIL_FROM || 'noreply@pizzaapp.dev';

    const plainTextList = items
      .map((item) => `- ${item.name} (${item.category}): Current Stock = ${item.currentStock} ${item.unit || 'units'} (Threshold: ${item.lowStockThreshold} ${item.unit || 'units'})`)
      .join('\n');

    const htmlRows = items
      .map((item) => {
        const optionDetail = item.linkedPizzaOption && item.linkedPizzaOption.name
          ? ` / Option: ${item.linkedPizzaOption.name}`
          : '';
        return `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px; font-weight: bold; color: #111827;">${item.name}${optionDetail}</td>
            <td style="padding: 10px; color: #4b5563; text-transform: capitalize;">${item.category}</td>
            <td style="padding: 10px; font-weight: bold; color: #dc2626;">${item.currentStock} ${item.unit || 'units'}</td>
            <td style="padding: 10px; color: #6b7280;">${item.lowStockThreshold} ${item.unit || 'units'}</td>
          </tr>
        `;
      })
      .join('');

    const mailOptions = {
      from,
      to: adminEmail,
      subject: `[ALERT] Low Stock Inventory Warning — ${items.length} Item${items.length > 1 ? 's' : ''} Below Threshold`,
      text: `Low Stock Inventory Alert\n\nThe following ${items.length} ingredient(s) have fallen below their configured low-stock thresholds:\n\n${plainTextList}\n\nPlease sign in to the Admin Dashboard to restock these items promptly.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
            ⚠️ Low Stock Inventory Alert
          </h2>
          <p style="color: #374151; font-size: 15px;">
            The automated inventory check detected that the following <strong>${items.length}</strong> ingredient${items.length > 1 ? 's are' : ' is'} currently below minimum threshold levels:
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; text-align: left; font-size: 14px;">
            <thead>
              <tr style="background-color: #f3f4f6; color: #374151;">
                <th style="padding: 10px; border-bottom: 2px solid #e5e7eb;">Ingredient</th>
                <th style="padding: 10px; border-bottom: 2px solid #e5e7eb;">Category</th>
                <th style="padding: 10px; border-bottom: 2px solid #e5e7eb;">Current Stock</th>
                <th style="padding: 10px; border-bottom: 2px solid #e5e7eb;">Threshold</th>
              </tr>
            </thead>
            <tbody>
              ${htmlRows}
            </tbody>
          </table>

          <p style="color: #4b5563; font-size: 14px; margin-top: 20px;">
            Please access the Administrative Portal to adjust stock quantities as replenishment arrives.
          </p>
        </div>
      `,
    };

    const transporter = EmailService.getTransporter();
    return transporter.sendMail(mailOptions);
  }
}

module.exports = EmailService;
