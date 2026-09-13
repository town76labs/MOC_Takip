import { supabase } from './supabase';

export type AppAccess = 'full' | 'sce_only' | 'overtime_only' | 'none';
export type OvertimeRole = 'admin' | 'operator' | 'viewer' | 'none';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  access: AppAccess;
  overtimeRole: OvertimeRole;
}

const LOGIN_EMAIL_BY_USERNAME: Record<string, string> = {
  'sarkhan.hajizada': 'sarkhan.hajizada@gmail.com',
  'kaan.ayaz': 'kaan.ayaz@moc-takip.example.com',
  'gokhan.kaya': 'gokhan.kaya@moc-takip.example.com',
  'ilhan.keskin': 'ilhan.keskin@moc-takip.example.com',
  'mehmet.zevker': 'mehmet.zevker@moc-takip.example.com',
  'şef': 'sef@moc-takip.example.com',
};

function normalizeLogin(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR');
}

function resolveLoginEmail(value: string) {
  const normalized = normalizeLogin(value);
  if (normalized.includes('@')) return normalized;
  return LOGIN_EMAIL_BY_USERNAME[normalized] ?? null;
}

async function loadProfile(userId: string): Promise<AuthUser> {
  if (!supabase) throw new Error('Supabase bağlantısı yapılandırılmadı.');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, app_access, overtime_role, active')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error('Kullanıcı yetki profili okunamadı.');
  }
  if (!data.active) {
    throw new Error('Bu kullanıcı hesabı devre dışı bırakılmış.');
  }

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    access: data.app_access as AppAccess,
    overtimeRole: data.overtime_role as OvertimeRole,
  };
}

export async function restoreAuthUser(): Promise<AuthUser | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;

  try {
    return await loadProfile(data.session.user.id);
  } catch {
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }
}

export async function signInWithUsername(
  username: string,
  password: string,
): Promise<AuthUser> {
  if (!supabase) throw new Error('Merkezi oturum bağlantısı yapılandırılmadı.');

  const email = resolveLoginEmail(username);
  if (!email) throw new Error('Kullanıcı adı veya şifre hatalı.');

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    throw new Error('Kullanıcı adı veya şifre hatalı.');
  }

  try {
    return await loadProfile(data.user.id);
  } catch (profileError) {
    await supabase.auth.signOut({ scope: 'local' });
    throw profileError;
  }
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut({ scope: 'local' });
}
