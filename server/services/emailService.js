const nodemailer = require('nodemailer');

// Email configuration
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

// Email sender name (can be customized)
const EMAIL_SENDER_NAME = process.env.EMAIL_SENDER_NAME || 'Tasket77';

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);

// Email templates
const emailTemplates = {
  workspaceAccess: (workspaceName, accessLevel, appUrl) => ({
    subject: `You've been invited to join workspace "${workspaceName}" on Tasket77`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Workspace Access Invitation</h2>
        <p>You've been invited to join workspace <strong>"${workspaceName}"</strong> on Tasket77.</p>
        <p><strong>Access Level:</strong> ${accessLevel.charAt(0).toUpperCase() + accessLevel.slice(1)}</p>
        <p>You can now access this workspace and collaborate with your team.</p>
        <div style="margin: 30px 0;">
          <a href="${appUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Go to Tasket77
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          If you don't have an account yet, you can register at the same link.
        </p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated message from Tasket77. Please do not reply to this email.
        </p>
      </div>
    `,
    text: `
Workspace Access Invitation

You've been invited to join workspace "${workspaceName}" on Tasket77.

Access Level: ${accessLevel.charAt(0).toUpperCase() + accessLevel.slice(1)}

You can now access this workspace and collaborate with your team.

Go to Tasket77: ${appUrl}

If you don't have an account yet, you can register at the same link.

---
This is an automated message from Tasket77. Please do not reply to this email.
    `
  })
};

// Send workspace access email
async function sendWorkspaceAccessEmail(email, workspaceName, accessLevel) {
  try {
    // Check if email is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log(`📧 Email not configured. Would send to ${email}: You've been invited to join workspace "${workspaceName}" with ${accessLevel} access`);
      console.log(`📧 App URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      return { success: false, reason: 'Email not configured' };
    }

    const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const template = emailTemplates.workspaceAccess(workspaceName, accessLevel, appUrl);

    const mailOptions = {
      from: `"${EMAIL_SENDER_NAME}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent successfully to ${email}:`, info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('📧 Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// Test email configuration
async function testEmailConfig() {
  try {
    console.log('🔍 Checking email configuration...');
    console.log('📧 SMTP_USER:', process.env.SMTP_USER ? 'Set' : 'Not set');
    console.log('📧 SMTP_PASS:', process.env.SMTP_PASS ? 'Set' : 'Not set');
    console.log('📧 SMTP_HOST:', process.env.SMTP_HOST || 'smtp.gmail.com (default)');
    console.log('📧 SMTP_PORT:', process.env.SMTP_PORT || '587 (default)');
    
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('📧 Email service not configured. Set SMTP_USER and SMTP_PASS environment variables to enable email notifications.');
      return false;
    }

    await transporter.verify();
    console.log('📧 Email service configured successfully');
    return true;
  } catch (error) {
    console.error('📧 Email service configuration error:', error);
    return false;
  }
}

module.exports = {
  sendWorkspaceAccessEmail,
  testEmailConfig
}; 