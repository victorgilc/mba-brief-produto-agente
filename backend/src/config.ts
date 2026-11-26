export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://catraca:catraca@localhost:5432/catraca',
  partnerApiKey: process.env.PARTNER_API_KEY ?? 'catraca-partner-key-2026',
  gatewayDelayMode: (process.env.GATEWAY_DELAY_MODE ?? 'default') as
    | 'default'
    | 'fast',
  sessionCookieName: 'catraca_session',
  sessionTtlDays: 7
};
