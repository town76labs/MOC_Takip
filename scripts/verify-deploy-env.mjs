const requiredVariables = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
];

const missingVariables = requiredVariables.filter(
  (name) => !process.env[name]?.trim(),
);

if (missingVariables.length > 0) {
  throw new Error(
    `GitHub Actions secret eksik: ${missingVariables.join(', ')}`,
  );
}

const supabaseUrl = new URL(process.env.VITE_SUPABASE_URL);
if (
  supabaseUrl.protocol !== 'https:' ||
  !supabaseUrl.hostname.endsWith('.supabase.co')
) {
  throw new Error('VITE_SUPABASE_URL geçerli bir Supabase HTTPS adresi değil.');
}

console.log('GitHub Pages Supabase ayarları doğrulandı.');
