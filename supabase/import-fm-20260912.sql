-- FM.xlsx aktarımı · kaynak kesim tarihi 2026-09-12
-- Üretilen özet: 59 personel, 208 ayrıntılı mesai,
-- 1095.375 toplam yevmiye.
-- Tekrar çalıştırılabilir: source_ref alanları mükerrer kayıtları engeller.

begin;

do $$
begin
  if not exists (
    select 1 from public.profiles
    where username = 'sarkhan.hajizada' and active
  ) then
    raise exception 'Aktarımı yapacak sarkhan.hajizada profili bulunamadı.';
  end if;
end
$$;

-- Ekipten ayrılan 121748 Celil Akyol aktarım kapsamına alınmaz.
create temporary table fm_removed_person_calls (
  call_id uuid primary key
) on commit drop;

insert into fm_removed_person_calls (call_id)
select distinct participant.call_id
from public.overtime_participants participant
join public.personnel person on person.id = participant.personnel_id
where person.employee_no = '121748';

delete from public.overtime_participants participant
using public.personnel person
where participant.personnel_id = person.id
  and person.employee_no = '121748';

delete from public.overtime_calls call
using fm_removed_person_calls removed
where call.id = removed.call_id
  and not exists (
    select 1 from public.overtime_participants participant
    where participant.call_id = call.id
  );

delete from public.overtime_balance_adjustments adjustment
using public.personnel person
where adjustment.personnel_id = person.id
  and person.employee_no = '121748';

delete from public.personnel
where employee_no = '121748';

create temporary table fm_import_people (
  employee_no text primary key,
  first_name text not null,
  last_name text not null,
  unit text not null,
  carry_wage numeric(10, 3) not null,
  holiday_wage numeric(10, 3) not null,
  expected_count integer not null,
  expected_wage numeric(10, 3) not null
) on commit drop;

insert into fm_import_people values
  ('120640', 'AHMET', 'KAZANÇ', 'YRD.İŞL', 3, 0, 2, 9),
  ('120639', 'AHMET', 'KAYMAN', 'YYPE', 18, 0, 2, 27),
  ('121402', 'AHMET', 'KARTAL', 'YRD.İŞL', 10, 0, 2, 16),
  ('121577', 'AHMET', 'ÖZÇALIKOĞLU', 'YRD.İŞL', 10, 0, 3, 19),
  ('120644', 'AKSU', 'OĞUL', 'AROM', 15, 0, 4, 26.5),
  ('123422', 'ALİ', 'GÖKTAN', 'YRD.İŞL', 11, 0, 2, 16),
  ('121480', 'ALİ EMRE', 'KALDI', 'YRD.İŞL', 7, 0, 4, 19.5),
  ('120139', 'BAYRAM', 'ESEN', 'YRD.İŞL', 6, 0, 4, 17.5),
  ('121554', 'BEKİR', 'YAZICI', 'ACN', 6, 0, 3, 15),
  ('105829', 'BEYTULLAH', 'BAHAR', 'YRD.İŞL', 8, 0, 2, 14),
  ('120141', 'CANER', 'GARGILI', 'ACN', 10, 0, 0, 10),
  ('120101', 'CEM', 'CANTEZ', 'ETİLEN', 7, 0, 2, 13),
  ('120250', 'CİHAN', 'TEPE', 'ETİLEN', 8, 0, 0, 8),
  ('121257', 'EMRAH', 'ALIM', 'PVC', 8, 0, 3, 19.5),
  ('120666', 'EMRE', 'AKAYDIN', 'ETİLEN', 3, 0, 4, 13),
  ('120236', 'EMRE', 'SOYSERT', 'PA', 13, 0, 1, 16),
  ('121262', 'EMRE', 'KAYHÜYÜK', 'YRD.İŞL', 4, 0, 4, 19),
  ('120673', 'ENGİN', 'SARISU', 'ETİLEN', 8, 0, 3, 16),
  ('120053', 'FATİH', 'ACARER', 'ETİLEN', 9, 0, 2, 13),
  ('120684', 'FEHMİ', 'DEMİR', 'PVC', 22, 0, 10, 56),
  ('105640', 'HAKAN', 'KIVANÇ', 'AROM', 3, 0, 2, 10),
  ('120705', 'HULUSİ', 'BEKCE', 'AROM', 7, 0, 5, 21.5),
  ('105653', 'İSA', 'KETENCİ', 'YRD.İŞL', 6.125, 0, 0, 6.125),
  ('105143', 'İSMAİL', 'ÜRÜN', 'PTA-PİF', 12, 0, 2, 17),
  ('105658', 'İSMAİL', 'DOĞAN', 'AYPE', 10.125, 0, 5, 22.125),
  ('121462', 'KADİR', 'KADEH', 'AROM', 9, 0, 3, 22),
  ('120729', 'MAHİR', 'YILMAZ', 'AYPE', 17, 0, 2, 22),
  ('120158', 'MEHMET', 'HALAÇ', 'ACN', 7, 0, 6, 23.5),
  ('121519', 'MEHMET', 'ATMACA', 'ACN', 4, 0, 3, 14),
  ('120449', 'MEHMET', 'IŞIK', 'AROM', 11, 0, 4, 23),
  ('120190', 'MEHMET', 'KOÇ', 'PVC', 8, 0, 6, 23.5),
  ('120036', 'MEHMET', 'ÖZGÜR', 'PA', 6, 0, 4, 15),
  ('120751', 'MURAT', 'TOĞA', 'ETİLEN', 6, 0, 5, 22.5),
  ('120745', 'MURAT', 'KESKEN', 'AROM', 6, 0, 2, 14),
  ('105666', 'MURAT', 'SAYAR', 'PA', 8, 0, 0, 8),
  ('120743', 'MURAT', 'ÇİFTÇİ', 'ETİLEN', 6, 0, 2, 12),
  ('120112', 'NACİ', 'ÇALIŞ', 'AYPE', 7, 0, 6, 24),
  ('121460', 'ONUR', 'ERDOĞAN', 'YRD.İŞL', 7, 0, 3, 17.5),
  ('123421', 'ONUR', 'TAŞ', 'AYPE-T', 7, 0, 5, 19),
  ('120770', 'ORHAN', 'CEYHAN', 'PP', 7, 0, 8, 29),
  ('120140', 'ÖNDER', 'ETCE', 'AYPE-T', 13, 0, 4, 21),
  ('121490', 'RAMAZAN', 'GÜNDÜZ', 'PP', 8, 0, 2, 16),
  ('123435', 'RIZA', 'ŞİRİN', 'YRD.İŞL', 8, 0, 5, 22.5),
  ('120795', 'SAMET', 'FİDAN', 'AYPE-T', 8, 0, 4, 19),
  ('120802', 'SERDAR', 'DEMİR', 'PP', 6, 0, 7, 22),
  ('120028', 'SERHAT', 'ÇALIK', 'PA', 11.125, 0, 2, 15.125),
  ('120807', 'SEYHAN', 'AKGÜN', 'PA', 9, 0, 5, 19),
  ('120181', 'SEZGİN', 'KILIÇ', 'YYPE', 10, 0, 5, 23.5),
  ('120814', 'ŞÜKRÜ', 'ÜNLÜ', 'YYPE', 9, 0, 3, 18.5),
  ('120178', 'TAYFUN', 'KAYDUL', 'ETİLEN', 10, 0, 4, 21),
  ('120150', 'TUNCAY', 'GÜLER', 'YRD.İŞL', 8, 0, 3, 16),
  ('121766', 'TURABİ', 'AKBAL', 'ETİLEN', 9, 0, 3, 20),
  ('123430', 'UĞUR', 'UYAROĞLU', 'YRD.İŞL', 8, 0, 3, 16),
  ('120823', 'UTKU', 'ÖLKEN', 'AROM', 9, 0, 5, 23.5),
  ('121432', 'ÜMİT', 'GÜRPINAR', 'ETİLEN', 0, 0, 7, 22),
  ('120826', 'VEYSEL', 'TONGA', 'AYPE-T', 8, 0, 4, 18),
  ('120830', 'YALÇIN', 'USLU', 'YRD.İŞL', 6, 0, 6, 21),
  ('120838', 'YUSUF ZİYA', 'YAĞCI', 'ETİLEN', 7, 0, 6, 24.5),
  ('105665', 'YÜKSEL', 'GÜL', 'AROM', 8, 0, 0, 8);

do $$
declare
  missing_count integer;
begin
  select count(*) into missing_count
  from fm_import_people source
  left join public.personnel person on person.employee_no = source.employee_no
  where person.id is null;

  if missing_count > 0 then
    raise exception '% personel ana listede bulunamadı.', missing_count;
  end if;
end
$$;

create temporary table fm_import_events (
  source_cell text primary key,
  employee_no text not null,
  work_date date not null,
  location text not null,
  task_description text not null,
  source_hours text not null,
  start_time time not null,
  end_time time not null,
  ends_next_day boolean not null,
  wage_credit numeric(10, 3) not null,
  overtime_type public.overtime_type not null,
  call_source_ref text not null
) on commit drop;

insert into fm_import_events values
  ('K3', '120640', '2026-07-15', 'ETİLEN', 'Resmi Tatil Vardiya FM', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:862f0ce4e443c1566065'),
  ('L3', '120640', '2026-09-05', 'YRD.İŞL.', 'TG-3 ve Yasal Bakım', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:435f2e633a25f64d6211'),
  ('K8', '120639', '2026-07-25', 'AROM', 'F401 Fırın montajı', '08:00-20:00', '08:00', '20:00', false, 4.5, 'full_day', 'FM-20260912:call:646c4aa47a6ed6604754'),
  ('L8', '120639', '2026-07-26', 'AROM', 'F401 Fırın montajı', '08:00-20:00', '08:00', '20:00', false, 4.5, 'full_day', 'FM-20260912:call:56bb343a95153787eef2'),
  ('K13', '121402', '2026-07-15', 'ETİLEN', 'Resmi Tatil Vardiya FM', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:862f0ce4e443c1566065'),
  ('L13', '121402', '2026-09-05', 'PP', 'EX İŞLER', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:3538aefdac5dc78bdb69'),
  ('K18', '121577', '2026-08-23', 'AYPE', 'AYPE-2 DECOMP', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:3242a79fc4a35da6b0a8'),
  ('L18', '121577', '2026-09-05', 'PP', 'EX İŞLER', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:3538aefdac5dc78bdb69'),
  ('M18', '121577', '2026-09-12', 'YRD.İŞL.', 'TG-2 Duruş', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:b138df94eab5f970a517'),
  ('K23', '120644', '2026-07-25', 'AROM', 'F401 Fırın montajı', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:646c4aa47a6ed6604754'),
  ('L23', '120644', '2026-07-26', 'AROM', 'F401 Fırın montajı', '08:00-20:00', '08:00', '20:00', false, 4.5, 'full_day', 'FM-20260912:call:56bb343a95153787eef2'),
  ('M23', '120644', '2026-07-29', 'AROM', 'F401 Fırın montajı', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:1c5a383369034237b6a7'),
  ('N23', '120644', '2026-08-27', 'AROM', 'HHS Duruş', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:592a984b70deb2e050a1'),
  ('K28', '123422', '2026-08-15', 'AYPE', 'AYPE2 DEKOMP', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:56c2116d4ce253859567'),
  ('L28', '123422', '2026-08-26', 'AYPE-T', 'AYPE-T K102 ROD', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:2f87fc3752168811acba'),
  ('K33', '121480', '2026-07-28', 'AROM', 'F401 Fırın montajı', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:6aec9600edcc7eb58e7e'),
  ('L33', '121480', '2026-08-20', 'AYPE', 'AYPE-2 DEKOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:7bc7feaba3194aa085eb'),
  ('M33', '121480', '2026-08-22', 'AYPE', 'AYPE-1 DURUŞ', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:b0d9a4602c485a251415'),
  ('N33', '121480', '2026-09-10', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 5.5, 'continuation', 'FM-20260912:call:dacc1cc2db742c253bd2'),
  ('K38', '120139', '2026-09-09', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:28e92e13cf00d4f14eb3'),
  ('L38', '120139', '2026-09-10', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dacc1cc2db742c253bd2'),
  ('M38', '120139', '2026-09-11', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:378cb745d300b2c25f2b'),
  ('N38', '120139', '2026-09-12', 'YYPE', 'YYPE TA', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:3f22b079a76dba69c62f'),
  ('K43', '121554', '2026-07-26', 'YRD.İŞL.', 'İzinli Personel Yerine', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:81a3222c0e53a45afb7c'),
  ('L43', '121554', '2026-09-09', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:28e92e13cf00d4f14eb3'),
  ('M43', '121554', '2026-09-11', 'YYPE', 'YYPE TA', '08:00-16:00', '08:00', '16:00', false, 4, 'full_day', 'FM-20260912:call:378cb745d300b2c25f2b'),
  ('K48', '105829', '2026-08-15', 'AYPE', 'AYPE2 DEKOMP', '16:00-00:00', '16:00', '00:00', true, 3, 'continuation', 'FM-20260912:call:56c2116d4ce253859567'),
  ('L48', '105829', '2026-08-22', 'AYPE', 'AYPE-1 DURUŞ', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:b0d9a4602c485a251415'),
  ('K63', '120101', '2026-09-05', 'PP', 'EX İŞLER', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:3538aefdac5dc78bdb69'),
  ('L63', '120101', '2026-09-12', 'YRD.İŞL.', 'TG-2 Duruş', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:b138df94eab5f970a517'),
  ('K73', '121257', '2026-07-15', 'ETİLEN', 'Resmi Tatil Vardiya FM', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:862f0ce4e443c1566065'),
  ('L73', '121257', '2026-07-25', 'AROM', 'F401 Fırın montajı', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:646c4aa47a6ed6604754'),
  ('M73', '121257', '2026-07-26', 'AROM', 'F401 Fırın montajı', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:56bb343a95153787eef2'),
  ('K78', '120666', '2026-07-25', 'YRD.İŞL.', 'İzinli Personel Yerine', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:43625ddf28a8dfecc2ed'),
  ('L78', '120666', '2026-07-28', 'AROM', 'F401 Fırın montajı', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:6aec9600edcc7eb58e7e'),
  ('M78', '120666', '2026-08-16', 'ETİLEN', 'İzinli Personel Yerine', '16:00-00:00', '16:00', '00:00', true, 3, 'continuation', 'FM-20260912:call:4b8ce2109427f6b1fb4f'),
  ('N78', '120666', '2026-08-21', 'AYPE', 'AYPE1 DURUŞ', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:5f089926f01d278abf4e'),
  ('K83', '120236', '2026-09-07', 'PA', 'İzinli Personel Yerine', '16:00-00:00', '16:00', '00:00', true, 3, 'continuation', 'FM-20260912:call:fd360c611220d7f41817'),
  ('K88', '121262', '2026-07-25', 'AROM', 'F401 Fırın montajı', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:646c4aa47a6ed6604754'),
  ('L88', '121262', '2026-07-27', 'AROM', 'F401 Fırın montajı', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:701ef0993955c12193ee'),
  ('M88', '121262', '2026-08-20', 'AYPE', 'AYPE-2 DEKOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:7bc7feaba3194aa085eb'),
  ('N88', '121262', '2026-09-12', 'YYPE', 'YYPE TA', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:3f22b079a76dba69c62f'),
  ('K93', '120673', '2026-08-16', 'AYPE', 'AYPE2 DEKOMP', '16:00-00:00', '16:00', '00:00', true, 3, 'continuation', 'FM-20260912:call:2255fad6645982b1f80d'),
  ('L93', '120673', '2026-08-24', 'AYPE-T', 'AYPE-T K102 ROD', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dec803ffccda7de528c6'),
  ('M93', '120673', '2026-08-30', 'AYPE', 'AYPE-2 DURUŞ', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:26f8aaaee59b0d6fec8e'),
  ('K98', '120053', '2026-08-06', 'AROM', 'FRALT-102 C TX değişimi', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:ef2e407ac3d6d9521b83'),
  ('L98', '120053', '2026-08-19', 'AYPE', 'AYPE-1 PPV244 DURUŞ', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:166228224fde83b5834c'),
  ('K103', '120684', '2026-07-25', 'AROM', 'F401 Fırın montajı', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:646c4aa47a6ed6604754'),
  ('L103', '120684', '2026-07-26', 'AROM', 'F401 Fırın montajı', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:56bb343a95153787eef2'),
  ('M103', '120684', '2026-07-27', 'AROM', 'F401 Fırın montajı', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:701ef0993955c12193ee'),
  ('N103', '120684', '2026-07-28', 'AROM', 'F401 Fırın montajı', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:6aec9600edcc7eb58e7e'),
  ('O103', '120684', '2026-07-29', 'AROM', 'F401 Fırın montajı', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:1c5a383369034237b6a7'),
  ('P103', '120684', '2026-08-06', 'AROM', 'FRALT-102 C TX değişimi', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:ef2e407ac3d6d9521b83'),
  ('Q103', '120684', '2026-08-27', 'AROM', 'HHS Duruş', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:592a984b70deb2e050a1'),
  ('R103', '120684', '2026-08-30', 'AROM', 'AROM HHS Duruş', '08:00-20:00', '08:00', '20:00', false, 6.5, 'full_day', 'FM-20260912:call:6388340f43ed0b402661'),
  ('S103', '120684', '2026-09-02', 'AROM', 'C101-C102 LT-LG', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:a763b6cb7ec0b02dc6e8'),
  ('T103', '120684', '2026-09-03', 'AROM', 'D106 Seviye Arızası', '17:00-00:00', '17:00', '00:00', true, 4.5, 'continuation', 'FM-20260912:call:2ea49a7f759e0a502d04'),
  ('K108', '105640', '2026-09-03', 'AYPE', 'AYPE-1 DECOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:66b8a1b77af6a23480c7'),
  ('L108', '105640', '2026-09-05', 'AYPE', 'AYPE-1 DECOMP', '08:00-20:00', '08:00', '20:00', false, 5, 'full_day', 'FM-20260912:call:0e48b1447b70d4661aba'),
  ('K113', '120705', '2026-07-15', 'ETİLEN', 'Resmi Tatil Vardiya FM', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:862f0ce4e443c1566065'),
  ('L113', '120705', '2026-07-29', 'AROM', 'F401 Fırın montajı', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:1c5a383369034237b6a7'),
  ('M113', '120705', '2026-08-17', 'AYPE', 'AYPE2 DEKOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:fa2723d5daae5d56e318'),
  ('N113', '120705', '2026-08-18', 'AYPE-T', 'AYPE-T K102 ROD', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:3401f0d89d5cfd5e6766'),
  ('O113', '120705', '2026-09-12', 'YYPE', 'YYPE TA', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:3f22b079a76dba69c62f'),
  ('K123', '105143', '2026-08-21', 'AYPE', 'AYPE1 DURUŞ', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:5f089926f01d278abf4e'),
  ('L123', '105143', '2026-08-29', 'AYPE', 'AYPE-2 DURUŞ', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:e7c22b1e326f19ad33b2'),
  ('K128', '105658', '2026-07-28', 'AYPE-T', 'AYPE-T Kompresör bakımı', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:ca58e9cf10e4c9c430a7'),
  ('L128', '105658', '2026-08-16', 'AYPE', 'AYPE2 DEKOMP', '16:00-00:00', '16:00', '00:00', true, 4, 'continuation', 'FM-20260912:call:2255fad6645982b1f80d'),
  ('M128', '105658', '2026-08-17', 'AYPE', 'AYPE2 DEKOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:fa2723d5daae5d56e318'),
  ('N128', '105658', '2026-08-18', 'AYPE-T', 'AYPE-T K102 ROD', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:3401f0d89d5cfd5e6766'),
  ('O128', '105658', '2026-08-26', 'AYPE-T', 'AYPE-T K102 ROD', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:2f87fc3752168811acba'),
  ('K133', '121462', '2026-08-16', 'AYPE', 'AYPE2 DEKOMP', '16:00-00:00', '16:00', '00:00', true, 3, 'continuation', 'FM-20260912:call:2255fad6645982b1f80d'),
  ('L133', '121462', '2026-08-29', 'AROM', 'AROM HHS Duruş', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:622e15a128e9024aa430'),
  ('M133', '121462', '2026-09-03', 'AROM', 'D106 Seviye Arızası', '17:00-00:00', '17:00', '00:00', true, 4.5, 'continuation', 'FM-20260912:call:2ea49a7f759e0a502d04'),
  ('K138', '120729', '2026-08-15', 'AYPE', 'AYPE2 DEKOMP', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:56c2116d4ce253859567'),
  ('L138', '120729', '2026-08-17', 'AYPE', 'AYPE2 DEKOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:fa2723d5daae5d56e318'),
  ('K143', '120158', '2026-09-06', 'ETİLEN', 'ENERJİ-ÇEVRE KRİTİK', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:8216ec5291f16b74084d'),
  ('L143', '120158', '2026-09-08', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dc87824817ed4162d20e'),
  ('M143', '120158', '2026-09-09', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:28e92e13cf00d4f14eb3'),
  ('N143', '120158', '2026-09-10', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dacc1cc2db742c253bd2'),
  ('O143', '120158', '2026-09-11', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:378cb745d300b2c25f2b'),
  ('P143', '120158', '2026-09-12', 'YYPE', 'YYPE TA', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:3f22b079a76dba69c62f'),
  ('K148', '121519', '2026-08-09', 'PA', 'İzinli Personel Yerine', '00:00-08:00', '00:00', '08:00', false, 3, 'full_day', 'FM-20260912:call:38eedb7697acf3045253'),
  ('L148', '121519', '2026-08-15', 'ETİLEN', 'İzinli Personel Yerine', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:2d135036ca94952280c9'),
  ('M148', '121519', '2026-08-16', 'AYPE', 'AYPE2 DEKOMP', '16:00-00:00', '16:00', '00:00', true, 4, 'continuation', 'FM-20260912:call:2255fad6645982b1f80d'),
  ('K153', '120449', '2026-08-24', 'AYPE-T', 'AYPE-T K102 ROD', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dec803ffccda7de528c6'),
  ('L153', '120449', '2026-08-30', 'AROM', 'AROM HHS Duruş', '08:00-20:00', '08:00', '20:00', false, 5, 'full_day', 'FM-20260912:call:6388340f43ed0b402661'),
  ('M153', '120449', '2026-09-02', 'AROM', 'C101-C102 LT-LG', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:a763b6cb7ec0b02dc6e8'),
  ('N153', '120449', '2026-09-12', 'YRD.İŞL.', 'TG-2 Duruş', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:b138df94eab5f970a517'),
  ('K158', '120190', '2026-07-27', 'AROM', 'F401 Fırın montajı', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:701ef0993955c12193ee'),
  ('L158', '120190', '2026-07-28', 'AYPE-T', 'AYPE-T Kompresör bakımı', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:ca58e9cf10e4c9c430a7'),
  ('M158', '120190', '2026-09-09', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:28e92e13cf00d4f14eb3'),
  ('N158', '120190', '2026-09-10', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dacc1cc2db742c253bd2'),
  ('O158', '120190', '2026-09-11', 'YYPE', 'YYPE TA', '16:00-20:00', '16:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:378cb745d300b2c25f2b'),
  ('P158', '120190', '2026-09-12', 'YYPE', 'YYPE TA', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:3f22b079a76dba69c62f'),
  ('K163', '120036', '2026-08-06', 'AROM', 'FRALT-102 C TX değişimi', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:ef2e407ac3d6d9521b83'),
  ('L163', '120036', '2026-08-16', 'AYPE', 'AYPE2 DEKOMP', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:2255fad6645982b1f80d'),
  ('M163', '120036', '2026-08-21', 'AYPE', 'AYPE1 DURUŞ', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:5f089926f01d278abf4e'),
  ('N163', '120036', '2026-09-10', 'YRD.İŞL.', 'İSK-3 bakımı', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:a3c1767b4e4294d4d7b7'),
  ('K168', '120751', '2026-08-08', 'ETİLEN', 'İzinli Personel Yerine', '00:00-08:00', '00:00', '08:00', false, 3, 'full_day', 'FM-20260912:call:c8a8985dcf4b1cbf7b96'),
  ('L168', '120751', '2026-08-22', 'ETİLEN', 'İzinli Personel Yerine', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:ecb2d248abd543ca8d11'),
  ('M168', '120751', '2026-08-29', 'AROM', 'AROM HHS Duruş', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:622e15a128e9024aa430'),
  ('N168', '120751', '2026-09-11', 'YYPE', 'YYPE TA', '16:00-20:00', '16:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:378cb745d300b2c25f2b'),
  ('O168', '120751', '2026-09-12', 'YYPE', 'YYPE TA', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:3f22b079a76dba69c62f'),
  ('K173', '120745', '2026-08-29', 'AROM', 'AROM HHS Duruş', '08:00-20:00', '08:00', '20:00', false, 5, 'full_day', 'FM-20260912:call:622e15a128e9024aa430'),
  ('L173', '120745', '2026-09-12', 'PVC', 'PVC Ex İşleri', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:5089909eced26e122e9f'),
  ('K183', '120743', '2026-07-15', 'ETİLEN', 'Resmi Tatil Vardiya FM', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:862f0ce4e443c1566065'),
  ('L183', '120743', '2026-09-12', 'PVC', 'PVC Ex İşleri', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:5089909eced26e122e9f'),
  ('K188', '120112', '2026-08-16', 'AYPE', 'AYPE2 DEKOMP', '16:00-00:00', '16:00', '00:00', true, 3, 'continuation', 'FM-20260912:call:2255fad6645982b1f80d'),
  ('L188', '120112', '2026-08-23', 'AYPE', 'AYPE-2 DECOMP', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:3242a79fc4a35da6b0a8'),
  ('M188', '120112', '2026-09-02', 'AYPE', 'AYPE-1 DECOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:92e287e590fc59388101'),
  ('N188', '120112', '2026-09-03', 'AYPE', 'AYPE-1 DECOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:66b8a1b77af6a23480c7'),
  ('O188', '120112', '2026-09-04', 'AYPE', 'AYPE-1 DECOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:aafe6085bb4b74c1a949'),
  ('P188', '120112', '2026-09-05', 'AYPE', 'AYPE-1 DECOMP', '08:00-20:00', '08:00', '20:00', false, 5, 'full_day', 'FM-20260912:call:0e48b1447b70d4661aba'),
  ('K193', '121460', '2026-07-26', 'AROM', 'F401 Fırın montajı', '08:00-20:00', '08:00', '20:00', false, 4.5, 'full_day', 'FM-20260912:call:56bb343a95153787eef2'),
  ('L193', '121460', '2026-08-29', 'AROM', 'AROM HHS Duruş', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:622e15a128e9024aa430'),
  ('M193', '121460', '2026-09-12', 'PVC', 'PVC Ex İşleri', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:5089909eced26e122e9f'),
  ('K198', '123421', '2026-08-15', 'AYPE', 'AYPE2 DEKOMP', '16:00-00:00', '16:00', '00:00', true, 3, 'continuation', 'FM-20260912:call:56c2116d4ce253859567'),
  ('L198', '123421', '2026-08-19', 'AYPE', 'AYPE-1 PPV244 DURUŞ', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:166228224fde83b5834c'),
  ('M198', '123421', '2026-08-30', 'AYPE', 'AYPE-2 DURUŞ', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:26f8aaaee59b0d6fec8e'),
  ('N198', '123421', '2026-09-02', 'AYPE', 'AYPE-1 DECOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:92e287e590fc59388101'),
  ('O198', '123421', '2026-09-11', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:378cb745d300b2c25f2b'),
  ('K203', '120770', '2026-08-15', 'AYPE', 'AYPE2 DEKOMP', '16:00-00:00', '16:00', '00:00', true, 3, 'continuation', 'FM-20260912:call:56c2116d4ce253859567'),
  ('L203', '120770', '2026-08-19', 'AYPE', 'AYPE-1 PPV244 DURUŞ', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:166228224fde83b5834c'),
  ('M203', '120770', '2026-08-20', 'AYPE', 'AYPE2 DEKOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:092387f33d7d31275ed5'),
  ('N203', '120770', '2026-08-21', 'AYPE', 'AYPE1 DURUŞ', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:5f089926f01d278abf4e'),
  ('O203', '120770', '2026-08-22', 'AYPE', 'AYPE-1 DURUŞ', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:b0d9a4602c485a251415'),
  ('P203', '120770', '2026-08-30', 'AYPE', 'AYPE-2 DURUŞ', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:26f8aaaee59b0d6fec8e'),
  ('Q203', '120770', '2026-09-04', 'AYPE', 'AYPE-2 DURUŞ', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:80a195ddebe6499a9c7a'),
  ('R203', '120770', '2026-09-04', 'AYPE', 'AYPE-2 DURUŞ', '08:00-20:00', '08:00', '20:00', false, 4, 'full_day', 'FM-20260912:call:d6dac097a34e07c77d16'),
  ('K208', '120140', '2026-07-28', 'AYPE-T', 'AYPE-T Kompresör', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:93788c4065eb9765ebad'),
  ('L208', '120140', '2026-08-18', 'AYPE-T', 'AYPE-T K102 ROD', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:3401f0d89d5cfd5e6766'),
  ('M208', '120140', '2026-08-24', 'AYPE-T', 'AYPE-T K102 ROD', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dec803ffccda7de528c6'),
  ('N208', '120140', '2026-08-26', 'AYPE-T', 'AYPE-T K102 ROD', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:2f87fc3752168811acba'),
  ('K213', '121490', '2026-07-06', 'AROM', 'İzinli Personel Yerine', '16:00-00:00', '16:00', '00:00', true, 3, 'continuation', 'FM-20260912:call:55f62370fdd5dc2b70c3'),
  ('L213', '121490', '2026-08-29', 'AROM', 'AROM HHS Duruş', '08:00-20:00', '08:00', '20:00', false, 5, 'full_day', 'FM-20260912:call:622e15a128e9024aa430'),
  ('K218', '123435', '2026-07-04', 'YRD.İŞL.', 'İzinli Personel Yerine', '16:00-00:00', '16:00', '00:00', true, 3, 'continuation', 'FM-20260912:call:97a2b33835c8642ac284'),
  ('L218', '123435', '2026-09-09', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:28e92e13cf00d4f14eb3'),
  ('M218', '123435', '2026-09-10', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dacc1cc2db742c253bd2'),
  ('N218', '123435', '2026-09-11', 'YYPE', 'YYPE TA', '16:00-20:00', '16:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:378cb745d300b2c25f2b'),
  ('O218', '123435', '2026-09-12', 'YYPE', 'YYPE TA', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:3f22b079a76dba69c62f'),
  ('K223', '120795', '2026-07-11', 'PVC', 'İzinli Personel Yerine', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:ea91a527dcdc80257777'),
  ('L223', '120795', '2026-09-04', 'AYPE', 'AYPE-1 DECOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:aafe6085bb4b74c1a949'),
  ('M223', '120795', '2026-09-05', 'AYPE', 'AYPE-1 DECOMP', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:0e48b1447b70d4661aba'),
  ('N223', '120795', '2026-09-12', 'YRD.İŞL.', 'TG-2 Duruş', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:b138df94eab5f970a517'),
  ('K228', '120802', '2026-07-23', 'ETİLEN', 'İzinli Personel Yerine', '16:00-00:00', '16:00', '00:00', true, 3, 'continuation', 'FM-20260912:call:c85ef8834dc732d14eaa'),
  ('L228', '120802', '2026-09-03', 'AYPE', 'AYPE-1 DECOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:66b8a1b77af6a23480c7'),
  ('M228', '120802', '2026-09-04', 'AYPE', 'AYPE-1 DECOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:aafe6085bb4b74c1a949'),
  ('N228', '120802', '2026-09-05', 'AYPE', 'AYPE-1 DECOMP', '08:00-20:00', '08:00', '20:00', false, 3, 'full_day', 'FM-20260912:call:0e48b1447b70d4661aba'),
  ('O228', '120802', '2026-09-08', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dc87824817ed4162d20e'),
  ('P228', '120802', '2026-09-09', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:28e92e13cf00d4f14eb3'),
  ('Q228', '120802', '2026-09-10', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dacc1cc2db742c253bd2'),
  ('K233', '120028', '2026-09-02', 'AYPE', 'AYPE-1 DECOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:92e287e590fc59388101'),
  ('L233', '120028', '2026-09-03', 'AYPE', 'AYPE-1 DECOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:66b8a1b77af6a23480c7'),
  ('K238', '120807', '2026-09-02', 'AYPE', 'AYPE-1 DECOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:92e287e590fc59388101'),
  ('L238', '120807', '2026-09-03', 'AYPE', 'AYPE-1 DECOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:66b8a1b77af6a23480c7'),
  ('M238', '120807', '2026-09-08', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dc87824817ed4162d20e'),
  ('N238', '120807', '2026-09-09', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:28e92e13cf00d4f14eb3'),
  ('O238', '120807', '2026-09-10', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dacc1cc2db742c253bd2'),
  ('K243', '120181', '2026-09-08', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dc87824817ed4162d20e'),
  ('L243', '120181', '2026-09-09', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:28e92e13cf00d4f14eb3'),
  ('M243', '120181', '2026-09-10', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dacc1cc2db742c253bd2'),
  ('N243', '120181', '2026-09-11', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:378cb745d300b2c25f2b'),
  ('O243', '120181', '2026-09-12', 'YYPE', 'YYPE TA', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:3f22b079a76dba69c62f'),
  ('K248', '120814', '2026-07-15', 'ETİLEN', 'Resmi Tatil Vardiya FM', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:862f0ce4e443c1566065'),
  ('L248', '120814', '2026-09-02', 'AROM', 'C101-C102 LT-LG', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:a763b6cb7ec0b02dc6e8'),
  ('M248', '120814', '2026-09-03', 'AROM', 'D106 Seviye Arızası', '17:00-00:00', '17:00', '00:00', true, 4.5, 'continuation', 'FM-20260912:call:2ea49a7f759e0a502d04'),
  ('K253', '120178', '2026-07-11', 'ETİLEN', 'İzinli Personel Yerine', '16:00-00:00', '16:00', '00:00', true, 3, 'continuation', 'FM-20260912:call:f7413b47655e6e6960e2'),
  ('L253', '120178', '2026-07-05', 'PA', 'İzinli Personel Yerine', '16:00-00:00', '16:00', '00:00', true, 3, 'continuation', 'FM-20260912:call:c6261f13a69ca6ec4be5'),
  ('M253', '120178', '2026-08-21', 'AYPE', 'AYPE1 DURUŞ', '16:00-20:00', '16:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:5f089926f01d278abf4e'),
  ('N253', '120178', '2026-09-12', 'PVC', 'PVC Ex İşleri', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:5089909eced26e122e9f'),
  ('K258', '120150', '2026-08-15', 'AYPE', 'AYPE2 DEKOMP', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:56c2116d4ce253859567'),
  ('L258', '120150', '2026-08-16', 'AYPE', 'AYPE2 DEKOMP', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:2255fad6645982b1f80d'),
  ('M258', '120150', '2026-08-17', 'AYPE', 'AYPE2 DEKOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:fa2723d5daae5d56e318'),
  ('K263', '121766', '2026-07-15', 'ETİLEN', 'Resmi Tatil Vardiya FM', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:862f0ce4e443c1566065'),
  ('L263', '121766', '2026-08-30', 'AROM', 'AROM HHS Duruş', '08:00-20:00', '08:00', '20:00', false, 5, 'full_day', 'FM-20260912:call:6388340f43ed0b402661'),
  ('M263', '121766', '2026-09-12', 'PVC', 'PVC Ex İşleri', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:5089909eced26e122e9f'),
  ('K268', '123430', '2026-09-03', 'AYPE', 'AYPE-1 DECOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:66b8a1b77af6a23480c7'),
  ('L268', '123430', '2026-09-05', 'YRD.İŞL.', 'TG-3 ve Yasal Bakım', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:435f2e633a25f64d6211'),
  ('M268', '123430', '2026-09-06', 'ETİLEN', 'ENERJİ-ÇEVRE KRİTİK', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:8216ec5291f16b74084d'),
  ('K273', '120823', '2026-09-06', 'ETİLEN', 'ENERJİ-ÇEVRE KRİTİK', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:8216ec5291f16b74084d'),
  ('L273', '120823', '2026-09-09', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:28e92e13cf00d4f14eb3'),
  ('M273', '120823', '2026-09-10', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dacc1cc2db742c253bd2'),
  ('N273', '120823', '2026-09-11', 'YYPE', 'YYPE TA', '16:00-20:00', '16:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:378cb745d300b2c25f2b'),
  ('O273', '120823', '2026-09-12', 'YYPE', 'YYPE TA', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:3f22b079a76dba69c62f'),
  ('K278', '121432', '2026-09-04', 'AYPE', 'AYPE-1 DECOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:aafe6085bb4b74c1a949'),
  ('L278', '121432', '2026-09-05', 'AYPE', 'AYPE-1 DECOMP', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:0e48b1447b70d4661aba'),
  ('M278', '121432', '2026-09-06', 'ETİLEN', 'ENERJİ-ÇEVRE KRİTİK', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:8216ec5291f16b74084d'),
  ('N278', '121432', '2026-09-09', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:28e92e13cf00d4f14eb3'),
  ('O278', '121432', '2026-09-10', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dacc1cc2db742c253bd2'),
  ('P278', '121432', '2026-09-11', 'YYPE', 'YYPE TA', '16:00-20:00', '16:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:378cb745d300b2c25f2b'),
  ('Q278', '121432', '2026-09-12', 'YYPE', 'YYPE TA', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:3f22b079a76dba69c62f'),
  ('K283', '120826', '2026-07-04', 'AYPE', 'İzinli Personel Yerine', '16:00-00:00', '16:00', '00:00', true, 3, 'continuation', 'FM-20260912:call:6bcda4afce2e29a87d63'),
  ('L283', '120826', '2026-08-20', 'AYPE', 'AYPE-2 DEKOMP', '16:00-20:00', '16:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:7bc7feaba3194aa085eb'),
  ('M283', '120826', '2026-08-29', 'AYPE', 'AYPE-2 DURUŞ', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:e7c22b1e326f19ad33b2'),
  ('N283', '120826', '2026-09-05', 'AYPE', 'AYPE-1 DEKOMP', '16:00-20:00', '16:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:2ad56b7332289292da47'),
  ('L288', '120830', '2026-08-20', 'AYPE', 'AYPE-2 DEKOMP', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:7bc7feaba3194aa085eb'),
  ('M288', '120830', '2026-08-27', 'AROM', 'HHS Duruş', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:592a984b70deb2e050a1'),
  ('N288', '120830', '2026-08-29', 'AYPE', 'AYPE-2 DURUŞ', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:e7c22b1e326f19ad33b2'),
  ('O288', '120830', '2026-09-05', 'YRD.İŞL.', 'TG-3 ve Yasal Bakım', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:435f2e633a25f64d6211'),
  ('P288', '120830', '2026-09-10', 'YRD.İŞL.', 'İSK-3 bakımı', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:a3c1767b4e4294d4d7b7'),
  ('Q288', '120830', '2026-09-12', 'YRD.İŞL.', 'TG-2 Duruş', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:b138df94eab5f970a517'),
  ('K293', '120838', '2026-08-16', 'AYPE', 'AYPE2 DEKOMP', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:2255fad6645982b1f80d'),
  ('L293', '120838', '2026-08-23', 'AYPE', 'AYPE-2 DECOMP', '08:00-16:00', '08:00', '16:00', false, 3, 'full_day', 'FM-20260912:call:3242a79fc4a35da6b0a8'),
  ('M293', '120838', '2026-09-09', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:28e92e13cf00d4f14eb3'),
  ('N293', '120838', '2026-09-10', 'YYPE', 'YYPE TA', '17:00-20:00', '17:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:dacc1cc2db742c253bd2'),
  ('O293', '120838', '2026-09-11', 'YYPE', 'YYPE TA', '16:00-20:00', '16:00', '20:00', false, 2, 'continuation', 'FM-20260912:call:378cb745d300b2c25f2b'),
  ('P293', '120838', '2026-09-12', 'YYPE', 'YYPE TA', '08:00-20:00', '08:00', '20:00', false, 5.5, 'full_day', 'FM-20260912:call:3f22b079a76dba69c62f');

insert into public.overtime_calls (
  work_date, location, note, source_type, source_ref, created_by, updated_by
)
select distinct
  event.work_date,
  event.location,
  'FM.xlsx geçmiş aktarımı',
  'legacy_import',
  event.call_source_ref,
  actor.id,
  actor.id
from fm_import_events event
cross join lateral (
  select id from public.profiles where username = 'sarkhan.hajizada'
) actor
on conflict do nothing;

insert into public.overtime_tasks (call_id, description, sort_order)
select distinct call.id, event.task_description, 0
from fm_import_events event
join public.overtime_calls call on call.source_ref = event.call_source_ref
where not exists (
  select 1 from public.overtime_tasks task
  where task.call_id = call.id
    and task.description = event.task_description
);

insert into public.overtime_participants (
  call_id,
  personnel_id,
  overtime_type,
  starts_at,
  ends_at,
  wage_credit,
  scheduled_shift_code,
  note,
  source_ref
)
select
  call.id,
  person.id,
  event.overtime_type,
  (event.work_date::text || ' ' || event.start_time::text || '+03')::timestamptz,
  (
    (event.work_date + case when event.ends_next_day then 1 else 0 end)::text
    || ' ' || event.end_time::text || '+03'
  )::timestamptz,
  event.wage_credit,
  'day_08_17'::public.shift_code,
  'Kaynak: FM.xlsx ' || event.source_cell || ' · ' || event.source_hours,
  'FM-20260912:event:' || event.source_cell
from fm_import_events event
join public.overtime_calls call on call.source_ref = event.call_source_ref
join public.personnel person on person.employee_no = event.employee_no
where not exists (
  select 1 from public.overtime_participants participant
  where participant.source_ref = 'FM-20260912:event:' || event.source_cell
);

insert into public.overtime_balance_adjustments (
  personnel_id,
  effective_date,
  occurrence_delta,
  wage_credit_delta,
  description,
  source_ref,
  created_by
)
select
  person.id,
  date '2026-06-25',
  0,
  source.carry_wage + source.holiday_wage,
  'FM.xlsx devreden yevmiye (26.12.2025–25.06.2026)',
  'FM-20260912:opening:' || source.employee_no,
  actor.id
from fm_import_people source
join public.personnel person on person.employee_no = source.employee_no
cross join lateral (
  select id from public.profiles where username = 'sarkhan.hajizada'
) actor
where source.carry_wage + source.holiday_wage <> 0
on conflict (source_ref) do nothing;

-- Aktarılan bölümün Excel özetiyle birebir uyuşmadığı durumda işlemi durdur.
do $$
declare
  actual_count integer;
  actual_detail_wage numeric(10, 3);
  actual_opening_wage numeric(10, 3);
begin
  select count(*), coalesce(sum(wage_credit), 0)
  into actual_count, actual_detail_wage
  from public.overtime_participants
  where source_ref like 'FM-20260912:event:%';

  select coalesce(sum(wage_credit_delta), 0)
  into actual_opening_wage
  from public.overtime_balance_adjustments
  where source_ref like 'FM-20260912:opening:%';

  if actual_count <> 208
    or actual_detail_wage <> 600
    or actual_opening_wage <> 495.375 then
    raise exception 'FM.xlsx aktarım doğrulaması başarısız.';
  end if;
end
$$;

commit;

select
  count(*) filter (where participant.source_ref like 'FM-20260912:event:%')
    as imported_overtime_count,
  coalesce(sum(participant.wage_credit)
    filter (where participant.source_ref like 'FM-20260912:event:%'), 0)
    as imported_detail_wage
from public.overtime_participants participant;

select
  count(*) as opening_balance_count,
  coalesce(sum(wage_credit_delta), 0) as imported_opening_wage
from public.overtime_balance_adjustments
where source_ref like 'FM-20260912:opening:%';
