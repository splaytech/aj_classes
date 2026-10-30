// Who every app email is from (portal notifications and invites, ADR-0004, ADR-0010): the verified
// ajclasses.com.au domain, the same sender as the sign-in emails (config.toml).

export const SENDER = {
  name: 'AJ Classes',
  email: 'hello@ajclasses.com.au',
  replyTo: 'hello@ajclasses.com.au',
} as const;

export const FROM_HEADER = `${SENDER.name} <${SENDER.email}>`;
