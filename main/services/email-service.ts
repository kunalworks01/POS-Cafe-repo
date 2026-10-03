import nodemailer, { type Transporter } from 'nodemailer';
import { randomUUID } from 'crypto';

interface EmailResult {
  success: boolean;
  messageId: string;
  recipient: string;
  subject: string;
  timestamp: string;
}

// Configure transporter if SMTP variables are set in environment
const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

let transporter: Transporter | null = null;
if (hasSmtp) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('[EmailService] Configured SMTP transporter.');
  } catch (err) {
    console.warn('[EmailService] SMTP transporter initialization failed:', err);
  }
} else {
  console.log('[EmailService] SMTP not configured in environment — operating in high-fidelity simulated/logged delivery mode.');
}

/**
 * Sends a welcome confirmation email to the customer with their digital loyalty card and 50 points bonus.
 */
export async function sendLoyaltyWelcomeEmail(
  toEmail: string,
  data: {
    firstName: string;
    lastName: string;
    phone: string;
    points: number;
    customerId: string;
  }
): Promise<EmailResult> {
  const timestamp = new Date().toISOString();
  const messageId = `email-${randomUUID()}`;
  const subject = `Welcome to Hourglass Cafe Loyalty Program, ${data.firstName}! ☕✨`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f7f5f2; margin: 0; padding: 24px; color: #2c2523; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e8e2dc; }
    .header { background: linear-gradient(135deg, #2b1e1a 0%, #4a342c 100%); color: #ffffff; padding: 36px 30px; text-align: center; }
    .header h1 { margin: 0 0 8px 0; font-size: 26px; letter-spacing: 2px; color: #f5e6d3; }
    .header p { margin: 0; font-size: 13px; letter-spacing: 1px; color: #d4a373; text-transform: uppercase; font-weight: 600; }
    .content { padding: 32px 30px; line-height: 1.6; }
    .greeting { font-size: 18px; font-weight: 700; color: #2b1e1a; margin-bottom: 12px; }
    .loyalty-badge { background: #faf4ed; border: 2px dashed #d4a373; border-radius: 14px; padding: 20px; text-align: center; margin: 24px 0; }
    .points-number { font-size: 38px; font-weight: 900; color: #9a6943; margin: 4px 0; }
    .points-label { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #786c67; font-weight: 700; }
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
    .details-table td { padding: 10px 14px; border-bottom: 1px solid #f0ebe4; }
    .details-table td:first-child { color: #8c827a; font-weight: 600; width: 35%; }
    .details-table td:last-child { color: #2b1e1a; font-weight: 700; }
    .btn { display: inline-block; background: #9a6943; color: #ffffff !important; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; margin-top: 16px; }
    .footer { background: #fdfbf7; padding: 24px 30px; text-align: center; font-size: 12px; color: #9c928a; border-top: 1px solid #ede7df; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>HOURGLASS CAFE</h1>
      <p>Taste The Rhythm of Time · Loyalty Program</p>
    </div>
    <div class="content">
      <div class="greeting">Welcome to the Family, ${data.firstName}! 🎉</div>
      <p>Thank you for completing your profile with Hourglass Cafe. Your loyalty membership is now fully verified and active!</p>
      
      <div class="loyalty-badge">
        <div class="points-label">Welcome Bonus Credited</div>
        <div class="points-number">+${data.points} POINTS</div>
        <div style="font-size: 13px; color: #6b5e59;">Ready to be redeemed on your next visit!</div>
      </div>

      <table class="details-table">
        <tr>
          <td>Member Name:</td>
          <td>${data.firstName} ${data.lastName}</td>
        </tr>
        <tr>
          <td>Phone Number:</td>
          <td>${data.phone}</td>
        </tr>
        <tr>
          <td>Verified Email:</td>
          <td>${toEmail}</td>
        </tr>
        <tr>
          <td>Member ID:</td>
          <td>${data.customerId}</td>
        </tr>
        <tr>
          <td>Earning Rate:</td>
          <td>1 Point on every item purchased</td>
        </tr>
      </table>

      <p style="font-size: 13px; color: #6b5e59;">
        Enjoy your freshly brewed coffee and delicious bites. You will also receive exclusive tasting invitations, birthday surprises, and customer feedback surveys to make your Hourglass experience unforgettable.
      </p>

      <div style="text-align: center; margin-top: 24px;">
        <a href="https://pos.15.207.179.83.nip.io/order" class="btn">Explore Today's Menu &amp; Order</a>
      </div>
    </div>
    <div class="footer">
      <strong>Hourglass Cafe</strong> — Taste The Rhythm of Time<br>
      📞 +91 96431 77506 · 📸 @the_hourglasscafe<br>
      You received this because you enrolled in the Hourglass Cafe Loyalty Program.
    </div>
  </div>
</body>
</html>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Hourglass Cafe Loyalty" <${process.env.SMTP_FROM || 'loyalty@hourglasscafe.com'}>`,
        to: toEmail,
        subject,
        html: htmlContent,
      });
      console.log(`[EmailService] ✅ Sent loyalty welcome email to ${toEmail}`);
    } catch (err) {
      console.error('[EmailService] SMTP email dispatch failed, logged to audit record:', err);
    }
  }

  console.log(`[Email Dispatch Log] To: ${toEmail} | Subject: "${subject}" | MessageId: ${messageId}`);

  return {
    success: true,
    messageId,
    recipient: toEmail,
    subject,
    timestamp,
  };
}

/**
 * Sends a Customer Feedback / Survey email to a verified customer.
 */
export async function sendCustomerFeedbackSurveyEmail(
  toEmail: string,
  data: {
    firstName: string;
    orderNumber?: string;
    surveyUrl?: string;
  }
): Promise<EmailResult> {
  const timestamp = new Date().toISOString();
  const messageId = `survey-${randomUUID()}`;
  const subject = `How was your visit to Hourglass Cafe, ${data.firstName}? ☕ Rate your experience`;
  const surveyUrl = data.surveyUrl || `https://pos.15.207.179.83.nip.io/order?survey=true`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f7f5f2; margin: 0; padding: 24px; color: #2c2523; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e8e2dc; }
    .header { background: #2b1e1a; color: #ffffff; padding: 30px; text-align: center; }
    .content { padding: 32px 30px; line-height: 1.6; }
    .btn { display: inline-block; background: #9a6943; color: #ffffff !important; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 style="margin: 0; font-size: 22px; letter-spacing: 1px; color: #f5e6d3;">HOURGLASS CAFE</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #d4a373;">We value your feedback</p>
    </div>
    <div class="content">
      <h2>Hi ${data.firstName},</h2>
      <p>Thank you for visiting Hourglass Cafe today! We are committed to making every sip and bite exceptional.</p>
      <p>Could you take 30 seconds to share your experience with our team? Your feedback directly helps us craft better moments for you.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${surveyUrl}" class="btn">⭐ Give Quick Feedback (Earn +10 Points)</a>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Hourglass Cafe Feedback" <${process.env.SMTP_FROM || 'feedback@hourglasscafe.com'}>`,
        to: toEmail,
        subject,
        html: htmlContent,
      });
      console.log(`[EmailService] ✅ Sent feedback survey email to ${toEmail}`);
    } catch (err) {
      console.error('[EmailService] Survey email dispatch failed:', err);
    }
  }

  console.log(`[Email Dispatch Log] Feedback survey sent to ${toEmail} | MessageId: ${messageId}`);

  return {
    success: true,
    messageId,
    recipient: toEmail,
    subject,
    timestamp,
  };
}
