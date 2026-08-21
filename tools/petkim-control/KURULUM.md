# Petkim SCE kontrol Excel'i

Bu dosya, tek bir klasörde bulunan PDF dosyalarının adlarını Petkim teknik
tanıtıcı numaralarıyla eşleştirir. Gömülü listeden karşılık gelen ekipman
numarasını bulur. Alt klasörleri taramaz.

## Windows Excel kurulumu

1. `Petkim_SCE_Kontrol_Sablonu.xlsx` dosyasını Windows Excel'de açın.
2. `Alt + F11` ile VBA editörünü açın.
3. `File > Import File...` menüsünden `Petkim_Klasor_Tarama.bas` dosyasını seçin.
4. VBA editörünü kapatın.
5. Excel'de `Alt + F8` tuşlarına basın.
6. `PetkimKontrolKurulumu` makrosunu bir kez çalıştırın. Ayarlar sayfasına iki
   buton eklenir.
7. `Farklı Kaydet` ile dosya türünü **Excel Macro-Enabled Workbook (*.xlsm)**
   seçip `Petkim_SCE_Kontrol.xlsm` adıyla kaydedin. Uzantıyı elle değiştirmeyin.

## Her taramada

1. `Ayarlar` sayfasındaki `1. Klasor Sec` butonuna basın.
2. Petkim kalibrasyon PDF'lerinin doğrudan bulunduğu ortak klasörü seçin.
3. `2. PDF Raporlarini Tara` butonuna basın.
4. `Kontrol_Sonuclari` sayfasındaki bilgiler yenilenir.
5. Bu `.xlsm` dosyasını dashboardda **Petkim Kontrol Excel'i** alanına yükleyin.

PDF dosya adında teknik tanıtıcı numarasının bulunması yeterlidir. Örneğin
`206-1-XCV1-0712.pdf`, `Kalibrasyon_206-1-XCV1-0712_2026.pdf` ve
`Rapor (206-1-XCV1-0712).pdf` dosyaları `1100030104` ekipmanıyla eşleşir.

Tarama; Kalibrasyon Raporu, PDF Sayısı, aynı teknik tanıtıcı numarası geçen tüm
dosyaların Toplam Doküman sayısı, Rapor Klasörü, Örnek PDF ve Son Tarama Tarihi
alanlarını doldurur. K ve L sütunlarındaki manuel
Deferral/Açıklama bilgilerini ekipman numarasına göre korur.
