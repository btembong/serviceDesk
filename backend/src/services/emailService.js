const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = `UBFinance ServiceDesk <${process.env.EMAIL_FROM || 'noreply@ubfinance.com'}>`;

const sendEmail = async ({ to, subject, html }) => {
  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html });
    return { success: true, id: result.id };
  } catch (err) {
    console.error('[Email] Failed to send email:', err.message);
    return { success: false, error: err.message };
  }
};

const sendTicketCreatedEmail = async (user, ticket) => {
  return sendEmail({
    to: user.email,
    subject: `Ticket ${ticket.ticketNumber} Received — UBFinance ServiceDesk`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a365d">UBFinance ServiceDesk</h2>
        <p>Dear ${user.firstName},</p>
        <p>Your support ticket has been received and is being reviewed.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold">Ticket Number</td><td style="padding:8px;border:1px solid #e2e8f0">${ticket.ticketNumber}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold">Category</td><td style="padding:8px;border:1px solid #e2e8f0">${ticket.category.replace(/_/g, ' ')}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold">Status</td><td style="padding:8px;border:1px solid #e2e8f0">Open</td></tr>
        </table>
        <p>You can track your ticket status by logging in to the UBFinance ServiceDesk.</p>
        <p>If you did not raise this ticket, please contact us immediately.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
        <p style="color:#718096;font-size:12px">UBFinance ServiceDesk — Secure Banking Support</p>
      </div>
    `,
  });
};

const sendTicketStatusEmail = async (user, ticket, previousStatus) => {
  return sendEmail({
    to: user.email,
    subject: `Ticket ${ticket.ticketNumber} Update — UBFinance ServiceDesk`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a365d">UBFinance ServiceDesk</h2>
        <p>Dear ${user.firstName},</p>
        <p>Your ticket status has been updated.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold">Ticket Number</td><td style="padding:8px;border:1px solid #e2e8f0">${ticket.ticketNumber}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold">Previous Status</td><td style="padding:8px;border:1px solid #e2e8f0">${previousStatus}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold">New Status</td><td style="padding:8px;border:1px solid #e2e8f0">${ticket.status}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
        <p style="color:#718096;font-size:12px">UBFinance ServiceDesk — Secure Banking Support</p>
      </div>
    `,
  });
};

const sendOtpEmail = async (user, otp, action) => {
  return sendEmail({
    to: user.email,
    subject: `Your OTP Code — UBFinance ServiceDesk`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a365d">UBFinance ServiceDesk</h2>
        <p>Dear ${user.firstName},</p>
        <p>Your one-time password for <strong>${action}</strong> is:</p>
        <div style="background:#f7fafc;border:2px solid #1a365d;padding:20px;text-align:center;margin:20px 0;border-radius:8px">
          <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1a365d">${otp}</span>
        </div>
        <p>This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
        <p>If you did not request this, please contact us immediately.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
        <p style="color:#718096;font-size:12px">UBFinance ServiceDesk — Secure Banking Support</p>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async (user, resetLink) => {
  return sendEmail({
    to: user.email,
    subject: `Reset Your Password — UBFinance ServiceDesk`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a365d">UBFinance ServiceDesk</h2>
        <p>Dear ${user.firstName},</p>
        <p>We received a request to reset your password.</p>
        <div style="text-align:center;margin:30px 0">
          <a href="${resetLink}" style="background:#1a365d;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold">Reset Password</a>
        </div>
        <p>This link expires in <strong>15 minutes</strong>. If you did not request a password reset, ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
        <p style="color:#718096;font-size:12px">UBFinance ServiceDesk — Secure Banking Support</p>
      </div>
    `,
  });
};

const sendOutOfHoursEmail = async (user, ticket) => {
  return sendEmail({
    to: user.email,
    subject: `Ticket ${ticket.ticketNumber} Received — UBFinance ServiceDesk`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a365d">UBFinance ServiceDesk</h2>
        <p>Dear ${user.firstName},</p>
        <p>Your support ticket has been received. Our agents are currently offline.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold">Ticket Number</td><td style="padding:8px;border:1px solid #e2e8f0">${ticket.ticketNumber}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold">Category</td><td style="padding:8px;border:1px solid #e2e8f0">${ticket.category.replace(/_/g, ' ')}</td></tr>
        </table>
        <p style="background:#fff8e1;border-left:4px solid #f59e0b;padding:12px;border-radius:4px">
          You will be contacted within the next business day. Our support hours are <strong>Monday – Friday, 8:00 AM – 6:00 PM</strong>.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
        <p style="color:#718096;font-size:12px">UBFinance ServiceDesk — Secure Banking Support</p>
      </div>
    `,
  });
};

const sendKycResultEmail = async (user, status, reason) => {
  const isVerified = status === 'VERIFIED';
  return sendEmail({
    to: user.email,
    subject: `Identity Verification ${isVerified ? 'Successful' : 'Requires Attention'} — UBFinance ServiceDesk`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a365d">UBFinance ServiceDesk</h2>
        <p>Dear ${user.firstName},</p>
        ${isVerified
          ? `<p style="color:#276749">Your identity has been successfully verified. Your ticket is now being processed.</p>`
          : `<p style="color:#c53030">Your identity verification requires further review. ${reason ? `Reason: ${reason}` : 'An agent will contact you shortly.'}</p>`
        }
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
        <p style="color:#718096;font-size:12px">UBFinance ServiceDesk — Secure Banking Support</p>
      </div>
    `,
  });
};

module.exports = {
  sendTicketCreatedEmail,
  sendTicketStatusEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendKycResultEmail,
  sendOutOfHoursEmail,
};
