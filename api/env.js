export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.send(
    `(function(window){window.env=window.env||{};` +
    `window.env.SUPABASE_URL=${JSON.stringify(process.env.SUPABASE_URL || '')};` +
    `window.env.SUPABASE_ANON_KEY=${JSON.stringify(process.env.SUPABASE_ANON_KEY || '')};` +
    `window.env.SUPABASE_SERVICE_KEY=${JSON.stringify(process.env.SUPABASE_SERVICE_KEY || '')};` +
    `window.env.OPENROUTER_KEY=${JSON.stringify(process.env.OPENROUTER_KEY || '')};` +
    `})(this);`
  );
}
