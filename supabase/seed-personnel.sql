-- 12.09.2026 tarihinde paylaşılan Enstrüman Bakım personel listesi.
-- Tekrar çalıştırılabilir; mevcut siciller güncellenir ve aktif tutulur.

insert into public.personnel (
  employee_no,
  first_name,
  last_name,
  unit,
  work_group,
  personnel_role,
  active
)
values
  ('120770', 'Orhan', 'Ceyhan', 'PP', 'A', 'foreman', true),
  ('120644', 'Aksu', 'Oğul', 'AROM', 'A', 'technician', true),
  ('120826', 'Veysel', 'Tonga', 'AYPE-T', 'A', 'technician', true),
  ('121554', 'Bekir', 'Yazıcı', 'ACN', 'A', 'technician', true),
  ('121480', 'Ali Emre', 'Kaldı', 'YRD.İŞL', 'A', 'technician', true),

  ('120150', 'Tuncay', 'Güler', 'YRD.İŞL', 'B', 'foreman', true),
  ('120666', 'Emre', 'Akaydın', 'ETİLEN', 'B', 'technician', true),
  ('120639', 'Ahmet', 'Kayman', 'YYPE', 'B', 'technician', true),
  ('121257', 'Emrah', 'Alım', 'PVC', 'B', 'technician', true),
  ('123422', 'Ali', 'Göktan', 'YRD.İŞL', 'B', 'technician', true),

  ('120140', 'Önder', 'Etce', 'AYPE-T', 'C', 'foreman', true),
  ('120673', 'Engin', 'Sarisu', 'ETİLEN', 'C', 'technician', true),
  ('120053', 'Fatih', 'Acarer', 'ETİLEN', 'C', 'technician', true),
  ('120236', 'Emre', 'Soysert', 'PA', 'C', 'technician', true),
  ('105829', 'Beytullah', 'Bahar', 'YRD.İŞL', 'C', 'technician', true),

  ('105665', 'Yüksel', 'Gül', 'AROM', 'D', 'foreman', true),
  ('120705', 'Hulusi', 'Bekce', 'AROM', 'D', 'technician', true),
  ('105658', 'İsmail', 'Doğan', 'AYPE', 'D', 'technician', true),
  ('120729', 'Mahir', 'Yılmaz', 'AYPE', 'D', 'technician', true),
  ('121262', 'Emre', 'Kayhüyük', 'YRD.İŞL', 'D', 'technician', true),

  ('120101', 'Cem', 'Cantez', 'ETİLEN', 'L', 'foreman', true),
  ('120250', 'Cihan', 'Tepe', 'ETİLEN', 'L', 'foreman', true),
  ('120745', 'Murat', 'Kesken', 'AROM', 'L', 'foreman', true),
  ('105640', 'Hakan', 'Kıvanç', 'AROM', 'L', 'foreman', true),
  ('120141', 'Caner', 'Gargılı', 'ACN', 'L', 'foreman', true),
  ('120158', 'Mehmet', 'Halaç', 'ACN', 'L', 'foreman', true),
  ('120181', 'Sezgin', 'Kılıç', 'YYPE', 'L', 'foreman', true),
  ('105666', 'Murat', 'Sayar', 'PA', 'L', 'foreman', true),
  ('105143', 'İsmail', 'Ürün', 'PTA-PİF', 'L', 'foreman', true),
  ('120112', 'Naci', 'Çalış', 'AYPE', 'L', 'foreman', true),
  ('105653', 'İsa', 'Ketenci', 'YRD.İŞL', 'L', 'foreman', true),
  ('120684', 'Fehmi', 'Demir', 'PVC', 'L', 'foreman', true),
  ('120640', 'Ahmet', 'Kazanç', 'YRD.İŞL', 'L', 'foreman', true),
  ('120139', 'Bayram', 'Esen', 'YRD.İŞL', 'L', 'foreman', true),
  ('120751', 'Murat', 'Toğa', 'ETİLEN', 'L', 'technician', true),
  ('120178', 'Tayfun', 'Kaydul', 'ETİLEN', 'L', 'technician', true),
  ('120823', 'Utku', 'Ölken', 'AROM', 'L', 'technician', true),
  ('121432', 'Ümit', 'Gürpınar', 'ETİLEN', 'L', 'technician', true),
  ('120838', 'Yusuf Ziya', 'Yağcı', 'ETİLEN', 'L', 'technician', true),
  ('120743', 'Murat', 'Çiftçi', 'ETİLEN', 'L', 'technician', true),
  ('121766', 'Turabi', 'Akbal', 'ETİLEN', 'L', 'technician', true),
  ('121462', 'Kadir', 'Kadeh', 'AROM', 'L', 'technician', true),
  ('121519', 'Mehmet', 'Atmaca', 'ACN', 'L', 'technician', true),
  ('120449', 'Mehmet', 'Işık', 'AROM', 'L', 'technician', true),
  ('120190', 'Mehmet', 'Koç', 'PVC', 'L', 'technician', true),
  ('121490', 'Ramazan', 'Gündüz', 'PP', 'L', 'technician', true),
  ('120795', 'Samet', 'Fidan', 'AYPE-T', 'L', 'technician', true),
  ('120802', 'Serdar', 'Demir', 'PP', 'L', 'technician', true),
  ('120028', 'Serhat', 'Çalık', 'PA', 'L', 'technician', true),
  ('120807', 'Seyhan', 'Akgün', 'PA', 'L', 'technician', true),
  ('120814', 'Şükrü', 'Ünlü', 'YYPE', 'L', 'technician', true),
  ('120036', 'Mehmet', 'Özgür', 'PA', 'L', 'technician', true),
  ('123421', 'Onur', 'Taş', 'AYPE-T', 'L', 'technician', true),
  ('121402', 'Ahmet', 'Kartal', 'YRD.İŞL', 'L', 'technician', true),
  ('121460', 'Onur', 'Erdoğan', 'YRD.İŞL', 'L', 'technician', true),
  ('123435', 'Rıza', 'Şirin', 'YRD.İŞL', 'L', 'technician', true),
  ('123430', 'Uğur', 'Uyaroğlu', 'YRD.İŞL', 'L', 'technician', true),
  ('121577', 'Ahmet', 'Özçalıkoğlu', 'YRD.İŞL', 'L', 'technician', true),
  ('120830', 'Yalçın', 'Uslu', 'YRD.İŞL', 'L', 'technician', true)
on conflict (employee_no) do update
set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  unit = excluded.unit,
  work_group = excluded.work_group,
  personnel_role = excluded.personnel_role,
  active = excluded.active,
  updated_at = now();

select
  work_group,
  personnel_role,
  count(*) as personnel_count
from public.personnel
where active
group by work_group, personnel_role
order by work_group, personnel_role;
