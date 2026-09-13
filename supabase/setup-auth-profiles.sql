-- Authentication > Users bölümünde kullanıcılar oluşturulduktan sonra çalıştırın.
-- Bu dosya parola içermez; yalnızca uygulama kullanıcı adlarını ve yetkileri atar.

update public.profiles as profile
set
  username = account.username,
  display_name = account.display_name,
  app_access = account.app_access::public.app_access,
  overtime_role = account.overtime_role::public.overtime_role,
  active = true
from auth.users as auth_user
join (
  values
    (
      'sarkhan.hajizada@gmail.com',
      'sarkhan.hajizada',
      'Sarkhan Hajizada',
      'full',
      'admin'
    ),
    (
      'kaan.ayaz@moc-takip.example.com',
      'kaan.ayaz',
      'Kaan Ayaz',
      'full',
      'admin'
    ),
    (
      'gokhan.kaya@moc-takip.example.com',
      'gokhan.kaya',
      'Gökhan Kaya',
      'full',
      'admin'
    ),
    (
      'ilhan.keskin@moc-takip.example.com',
      'ilhan.keskin',
      'İlhan Keskin',
      'full',
      'admin'
    ),
    (
      'mehmet.zevker@moc-takip.example.com',
      'mehmet.zevker',
      'Mehmet Zevker',
      'sce_only',
      'none'
    ),
    (
      'sef@moc-takip.example.com',
      'şef',
      'Şef',
      'overtime_only',
      'operator'
    )
) as account(email, username, display_name, app_access, overtime_role)
  on lower(auth_user.email) = lower(account.email)
where profile.id = auth_user.id;

select
  username,
  display_name,
  app_access,
  overtime_role,
  active
from public.profiles
where username in ('sarkhan.hajizada', 'mehmet.zevker', 'şef')
order by username;

select
  profile.username,
  profile.display_name,
  profile.app_access,
  profile.overtime_role,
  profile.active
from public.profiles as profile
order by profile.username;
