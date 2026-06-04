let twilioClient = null;

if (
  process.env.TWILIO_ACCOUNT_SID &&
  !process.env.TWILIO_ACCOUNT_SID.includes('xxx')
) {
  const twilio = require('twilio');
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log('[SMS] Twilio client initialised');
} else {
  console.warn('[SMS] Twilio credentials not configured — SMS notifications disabled');
}

const FROM = process.env.TWILIO_PHONE_NUMBER;

/**
 * Send an SMS. Silently falls back if Twilio is not configured.
 * @param {string} to   Recipient phone number (E.164 format)
 * @param {string} body Message text
 */
const sendSms = async (to, body) => {
  if (!twilioClient || !to) return { success: false, reason: 'not_configured' };
  try {
    const msg = await twilioClient.messages.create({ from: FROM, to, body });
    return { success: true, sid: msg.sid };
  } catch (err) {
    console.error('[SMS] Failed to send SMS:', err.message);
    return { success: false, error: err.message };
  }
};

const sendTicketCreatedSms = (user, ticket) =>
  sendSms(user.phone, `UBFinance ServiceDesk: Your ticket ${ticket.ticketNumber} has been received and is under review.`);

const sendTicketStatusSms = (user, ticket) =>
  sendSms(user.phone, `UBFinance ServiceDesk: Ticket ${ticket.ticketNumber} status updated to ${ticket.status}.`);

const sendOtpSms = (user, otp) =>
  sendSms(user.phone, `UBFinance ServiceDesk: Your verification code is ${otp}. It expires in 5 minutes. Do not share it.`);

module.exports = { sendSms, sendTicketCreatedSms, sendTicketStatusSms, sendOtpSms };
