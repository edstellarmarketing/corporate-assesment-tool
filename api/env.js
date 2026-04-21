export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.send(
    `(function(window){window.env=window.env||{};` +
    `window.env.SUPABASE_URL=${JSON.stringify(process.env.SERVICE_URL_SUPABASEKONG || '')};` +
    `window.env.SUPABASE_ANON_KEY=${JSON.stringify(process.env.SERVICE_SUPABASEANON_KEY || '')};` +
    `window.env.SUPABASE_SERVICE_KEY=${JSON.stringify(process.env.SERVICE_SUPABASESERVICE_KEY || '')};` +
    `window.env.OPENROUTER_KEY=${JSON.stringify(process.env.OPENROUTER_KEY || '')};` +
    `window.env.GOOGLE_WEBAPP_URL=${JSON.stringify(process.env.GOOGLE_WEBAPP_URL || '')};` +
    `})(this);`
  );
}
