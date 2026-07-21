import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const KENOO_LOGO_URL = "https://assest.kenoo.io/logos/full-text.png";

export type OrganizationInviteEmailInput = {
  to: string;
  firstName?: string | null;
  organizationName: string;
  inviterName: string;
  ctaUrl: string;
  /** Shown on the primary button, e.g. "Accept invitation" or "Open Kenoo". */
  ctaLabel: string;
  /** Second paragraph under the greeting. */
  bodyText: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildOrganizationInviteEmailSubject(
  organizationName: string,
): string {
  return `You've been invited to ${organizationName} on Kenoo`;
}

export function buildOrganizationInviteEmailHtml(
  input: OrganizationInviteEmailInput,
): string {
  const firstName = input.firstName?.trim();
  const greeting = firstName
    ? `Hi ${escapeHtml(firstName)},`
    : "Hi,";
  const organizationName = escapeHtml(input.organizationName);
  const inviterName = escapeHtml(input.inviterName);
  const bodyText = escapeHtml(input.bodyText);
  const ctaLabel = escapeHtml(input.ctaLabel);
  const ctaUrl = escapeHtml(input.ctaUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to Kenoo</title>
</head>
<body style="margin:0; padding:0; background-color:#fcfcfc; -webkit-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
    You've been invited to join ${organizationName} on Kenoo.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fcfcfc;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px; background-color:#ffffff; border:1px solid #e8e8e8; border-radius:16px; overflow:hidden;">
          <tr>
            <td align="center" style="padding:32px 32px 24px;">
              <img src="${KENOO_LOGO_URL}" alt="Kenoo" width="140" style="display:block; width:140px; max-width:100%; height:auto; border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 8px;">
              <h1 style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:24px; line-height:30px; font-weight:600; letter-spacing:-0.03em; color:#111111;">
                You've been invited
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; line-height:22px; color:#6b6b6b;">
                ${inviterName} invited you to join
                <strong style="color:#111111;">${organizationName}</strong>
                on Kenoo.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px; background-color:#e8e8e8;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0 0 16px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; line-height:21px; color:#444444;">
                ${greeting}
              </p>
              <p style="margin:0 0 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; line-height:21px; color:#444444;">
                ${bodyText}
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius:12px; background-color:#111111;">
                    <a href="${ctaUrl}" target="_blank" style="display:inline-block; padding:14px 28px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; font-weight:600; line-height:16px; color:#ffffff; text-decoration:none; border-radius:12px;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; line-height:20px; color:#6b6b6b;">
                Need help? Email us at
                <a href="mailto:hello@kenoo.io" style="color:#111111; font-weight:500; text-decoration:underline;">hello@kenoo.io</a>.
              </p>
              <p style="margin:12px 0 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; line-height:20px; color:#6b6b6b;">
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px; background-color:#fafafa; border-top:1px solid #e8e8e8; text-align:center;">
              <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; line-height:18px; color:#6b6b6b;">
                Best regards,<br />
                <strong style="color:#111111;">The Kenoo Team</strong>
              </p>
              <p style="margin:10px 0 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:11px; line-height:16px; color:#999999;">
                © Kenoo · <a href="https://kenoo.io" style="color:#999999; text-decoration:underline;">kenoo.io</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getSesClient(): SESClient | null {
  const region = process.env.AWS_REGION?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!region || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new SESClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export async function sendOrganizationInviteEmail(
  input: OrganizationInviteEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fromEmail = process.env.SES_FROM_EMAIL?.trim();
  if (!fromEmail) {
    console.error("[settings] SES_FROM_EMAIL is not configured");
    return { ok: false, error: "Email service is not configured" };
  }

  const client = getSesClient();
  if (!client) {
    console.error("[settings] AWS SES credentials are not configured");
    return { ok: false, error: "Email service is not configured" };
  }

  const subject = buildOrganizationInviteEmailSubject(input.organizationName);
  const html = buildOrganizationInviteEmailHtml(input);

  try {
    await client.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: {
          ToAddresses: [input.to.trim().toLowerCase()],
        },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
          },
        },
      }),
    );
    return { ok: true };
  } catch (error) {
    console.error("[settings] send organization invite email:", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send organization invite email",
    };
  }
}
