import sgMail from '@sendgrid/mail';

interface SendEmailOptions {
  to: string;
  from: string;
  fromName: string;
  subject: string;
  body: string;
  unsubscribeUrl?: string;
  unsubscribeToken?: string;
  serverUrl?: string;
}

export async function sendEmail(options: SendEmailOptions, apiKey: string): Promise<string> {
  sgMail.setApiKey(apiKey);

  const { to, from, fromName, subject, body, unsubscribeToken, serverUrl } = options;

  const unsubscribeLink =
    unsubscribeToken && serverUrl
      ? `${serverUrl}/unsubscribe/${unsubscribeToken}`
      : options.unsubscribeUrl || '';

  const unsubscribeFooter = unsubscribeLink
    ? `\n\n---\nTo unsubscribe from these emails, click here: ${unsubscribeLink}`
    : '';

  const htmlBody = body
    .split('\n')
    .map((line) => `<p>${line || '&nbsp;'}</p>`)
    .join('');

  const [response] = await sgMail.send({
    to,
    from: { email: from, name: fromName },
    subject,
    text: body + unsubscribeFooter,
    html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">${htmlBody}${
      unsubscribeLink
        ? `<p style="color: #999; font-size: 12px; margin-top: 32px;">To unsubscribe, <a href="${unsubscribeLink}" style="color: #999;">click here</a>.</p>`
        : ''
    }</div>`,
    trackingSettings: {
      clickTracking: { enable: true },
      openTracking: { enable: true },
    },
  });

  const messageId = response.headers['x-message-id'] as string || '';
  return messageId;
}
