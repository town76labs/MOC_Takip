# Mesai Takibi Supabase kurulumu

Bu klasör Mesai Takibi modülünün merkezi veri modeli ve güvenlik
politikalarını içerir.

## Proje bağlantısı

1. Supabase organizasyonunda yeni bir proje oluşturun.
2. Proje URL'sini ve publishable/anon anahtarını `.env.local` dosyasına yazın:

   ```env
   VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=PUBLIC_KEY
   ```

3. `supabase/migrations` içindeki SQL migrasyonunu Supabase SQL Editor veya
   Supabase CLI ile uygulayın.

`service_role` anahtarı hiçbir zaman frontend dosyasına veya `VITE_` ile
başlayan bir değişkene yazılmamalıdır.

## İlk kullanıcı rolleri

Supabase Auth kullanıcıları oluşturulduktan sonra `profiles` tablosunda:

- Mesai yöneticileri: `app_access = full`, `overtime_role = admin`
- `şef`: `app_access = overtime_only`, `overtime_role = operator`
- Sadece SCE kullanıcısı: `app_access = sce_only`, `overtime_role = none`

olarak ayarlanır. Yeni kullanıcılar varsayılan olarak hiçbir erişim alamaz.

Mevcut dashboard hesaplarının toplu yetki ataması için
`setup-auth-profiles.sql` dosyası SQL Editor'da bir kez çalıştırılır. Parolalar
bu dosyada veya uygulama kaynak kodunda tutulmaz. Uygulamada eski kullanıcı
adları gösterilir; Supabase'in zorunlu email kimliği teknik eşleme olarak arka
planda kalır.

## Uygulama sırası

İlk kurulum dosyaları daha önce uygulandıysa FM.xlsx aktarımı için SQL
Editor'da şu yedi dosya sırayla çalıştırılır:

1. `migrations/20260913090000_overtime_legacy_import_foundation.sql`
2. `import-fm-20260912.sql`
3. `migrations/20260913100000_overtime_edit_cancel_rpc.sql`
4. `migrations/20260913123000_overtime_governance.sql`
5. `migrations/20260913140000_overtime_hardening.sql`
6. `migrations/20260913143000_overtime_production_fixes.sql`
7. `migrations/20260914093000_correct_shift_calendar_2026.sql`

Aktarım dosyası tekrar çalıştırılabilir. Kaynak referansları aynı Excel
kaydının ikinci kez eklenmesini engeller. Ekipten ayrılan Celil Akyol hariç
59 personel için 208 ayrıntılı mesai kaydı, 600 yevmiye ayrıntısı ve 495,375
devreden yevmiye doğrulanır. Daha önce uygulamadan girilen canlı kayıtlar
korunur.

## Denge dönemi yönetimi

Mesai yöneticisi, uygulamadaki **Denge Dönemi Yönetimi** bölümünden yeni bir
dönem başlatabilir. Bu işlem geçmiş mesai kayıtlarını silmez; personel denge
hesapları seçilen başlangıç tarihinden itibaren yeniden hesaplanır. Operatör ve
görüntüleyici hesapları bu işlemi göremez veya çalıştıramaz.

## Yönetim ve denetim

Mesai yöneticisi, uygulamadaki **Yönetim ve Denetim** bölümünden mevcut
kullanıcıların dashboard erişimini ve mesai rolünü; personelin birim, çalışma
grubu, personel tipi, aktiflik ve mesai uygunluğu bilgilerini yönetebilir.
Yetki ve personel değişiklikleri doğrudan tabloya değil güvenli RPC
fonksiyonlarına yazılır ve denetim kaydı oluşturur. İptal edilen mesailer,
iptal gerekçeleri ve son işlem geçmişi aynı bölümden görülebilir. Yeni Auth
kullanıcısı oluşturma ve parola işlemleri Supabase Auth ekranında kalır.

## Canlıya geçiş kontrolü

Son güvenlik migrasyonu uygulandıktan sonra `verify-overtime-production.sql`
dosyası SQL Editor'da çalıştırılır. Bu dosya veri değiştirmez. Vardiya
takvimini, mesai kurallarını, çakışmaları, iptal kayıtlarını, rol tutarlılığını
ve temel RLS ayrıcalıklarını kontrol eder. Sonuç tablosundaki bütün satırların
`BASARILI` olması beklenir.

2026 vardiya migrasyonu, Petrol-İş Aliağa vardiya kartındaki 40 takvim
sütununu A/B/C/D grupları için birebir uygular. `L` grubu hafta içi 08:00–17:00,
cumartesi ve pazar hafta tatili olarak tutulur.

GitHub Pages dağıtımı için repository Actions secrets bölümünde
`VITE_SUPABASE_URL` ve `VITE_SUPABASE_PUBLISHABLE_KEY` tanımlanmalıdır.
Dağıtım iş akışı bu değerler eksikse canlı siteyi bağlantısız yayınlamak yerine
işlemi durdurur. Her push öncesinde `npm run verify` ile lint, otomatik test ve
üretim derlemesi birlikte çalıştırılabilir.

## Mesai raporları

Mesai Takibi ekranındaki raporlama bölümü tarih, personel tipi, çalışma grubu
ve personel filtrelerini birlikte uygular. Excel çıktısı `Yönetici Özeti`,
`Mesai Detayı` ve `Devreden Bakiyeler` sayfalarını içerir. PDF çıktısı yönetici
özeti veya ayrıntılı rapor olarak alınabilir. Ayrıntısı bulunmayan FM.xlsx
bakiyeleri, detaylı mesai kayıtlarından ayrı gösterilir.
