# Email Service Setup Guide

This guide will help you configure email notifications for workspace access invitations.

## Overview

When users are added to workspaces, they receive email notifications with:
- Workspace name and access level
- Direct link to the application
- Instructions for new users to register

## Configuration Options

### Option 1: Gmail (Recommended for testing)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
3. **Set environment variables**:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-character-app-password
   ```

### Option 2: Outlook/Hotmail

```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### Option 3: Other Providers

Check your email provider's SMTP settings and configure accordingly.

## Environment Variables

Copy `server/env.example` to `server/.env` and configure:

```bash
# Required for email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Optional: Frontend URL for email links
FRONTEND_URL=http://localhost:3000
```

## Testing

1. **Install dependencies**:
   ```bash
   cd server
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Check server logs** for email configuration status:
   ```
   📧 Email service configured successfully
   ```

4. **Add a user to a workspace** and check if email is sent.

## Troubleshooting

### "Email not configured" message
- Check that `SMTP_USER` and `SMTP_PASS` are set
- Verify email credentials are correct

### "Authentication failed" error
- For Gmail: Use App Password, not regular password
- For Outlook: Enable "Less secure app access" or use App Password

### "Connection timeout" error
- Check firewall settings
- Verify SMTP host and port are correct
- Try different port (465 with SSL, or 587 with TLS)

## Email Templates

The system sends professional HTML emails with:
- Clear workspace invitation message
- Access level information
- Direct link to the application
- Fallback text version

## Security Notes

- Use App Passwords instead of regular passwords
- Keep environment variables secure
- Consider using environment-specific configurations
- Monitor email sending logs for any issues 