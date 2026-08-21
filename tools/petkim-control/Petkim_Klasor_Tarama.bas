Attribute VB_Name = "PetkimKlasorTarama"
Option Explicit

Private Const SETTINGS_SHEET As String = "Ayarlar"
Private Const EQUIPMENT_SHEET As String = "Ekipman_Listesi"
Private Const RESULT_SHEET As String = "Kontrol_Sonuclari"

Public Sub PetkimKontrolKurulumu()
    Dim ws As Worksheet

    Set ws = ThisWorkbook.Worksheets(SETTINGS_SHEET)
    ws.Range("A1").Value = "Ana Klasor"
    ws.Range("A2").Value = "Son Tarama"
    ws.Range("A3").Value = "Tarama Kurali"
    ws.Range("B3").Value = "Secilen klasorun dogrudan icindeki PDF dosya adinda Teknik Tanitici No aranir."
    ws.Columns("A").ColumnWidth = 20
    ws.Columns("B").ColumnWidth = 95

    AyarlarButonlariniOlustur
    MsgBox "Petkim kontrol Excel'i kullanima hazir.", vbInformation
End Sub

Public Sub KlasorSec()
    Dim secici As FileDialog
    Dim secilenKlasor As String

    Set secici = Application.FileDialog(4)
    With secici
        .Title = "Petkim kalibrasyon PDF klasorunu secin"
        .AllowMultiSelect = False
        If .Show <> -1 Then Exit Sub
        secilenKlasor = .SelectedItems(1)
    End With

    ThisWorkbook.Worksheets(SETTINGS_SHEET).Range("B1").Value = secilenKlasor
    MsgBox "Klasor kaydedildi:" & vbCrLf & secilenKlasor, vbInformation
End Sub

Public Sub PDFRaporlariniTara()
    Dim wsAyar As Worksheet
    Dim wsListe As Worksheet
    Dim wsSonuc As Worksheet
    Dim fso As Object
    Dim klasor As Object
    Dim dosya As Object
    Dim dokumanDosyalari As Collection
    Dim manuelBilgiler As Object
    Dim anaKlasor As String
    Dim sonListeSatiri As Long
    Dim sonSonucSatiri As Long
    Dim satir As Long
    Dim sonucSatiri As Long
    Dim ekipmanNo As String
    Dim teknikTaniticiNo As String
    Dim ekipmanTipi As String
    Dim pdfYolu As Variant
    Dim pdfSayisi As Long
    Dim dokumanSayisi As Long
    Dim ilkPdf As String
    Dim anahtar As String
    Dim eskiBilgi As Variant
    Dim toplamEkipman As Long
    Dim eslesenEkipman As Long
    Dim toplamPdf As Long
    Dim toplamDokuman As Long

    On Error GoTo Hata

    Set wsAyar = ThisWorkbook.Worksheets(SETTINGS_SHEET)
    Set wsListe = ThisWorkbook.Worksheets(EQUIPMENT_SHEET)
    Set wsSonuc = ThisWorkbook.Worksheets(RESULT_SHEET)

    anaKlasor = Trim$(CStr(wsAyar.Range("B1").Value))
    If Len(anaKlasor) = 0 Then
        MsgBox "Once 'Klasor Sec' butonuyla PDF klasorunu secin.", vbExclamation
        Exit Sub
    End If

    Set fso = CreateObject("Scripting.FileSystemObject")
    If Not fso.FolderExists(anaKlasor) Then
        MsgBox "Klasore erisilemiyor:" & vbCrLf & anaKlasor, vbExclamation
        Exit Sub
    End If

    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.StatusBar = "Petkim PDF dosyalari okunuyor..."

    Set dokumanDosyalari = New Collection
    Set klasor = fso.GetFolder(anaKlasor)
    For Each dosya In klasor.Files
        dokumanDosyalari.Add CStr(dosya.Path)
        toplamDokuman = toplamDokuman + 1
        If LCase$(fso.GetExtensionName(dosya.Name)) = "pdf" Then
            toplamPdf = toplamPdf + 1
        End If
    Next dosya

    Set manuelBilgiler = CreateObject("Scripting.Dictionary")
    manuelBilgiler.CompareMode = vbTextCompare
    sonSonucSatiri = wsSonuc.Cells(wsSonuc.Rows.Count, "B").End(xlUp).Row
    For satir = 2 To sonSonucSatiri
        anahtar = NormalizeEquipmentNo(CStr(wsSonuc.Cells(satir, "B").Value))
        If Len(anahtar) > 0 Then
            manuelBilgiler(anahtar) = Array( _
                wsSonuc.Cells(satir, "K").Value, _
                wsSonuc.Cells(satir, "L").Value _
            )
        End If
    Next satir

    wsSonuc.Range("A2:L" & wsSonuc.Rows.Count).ClearContents
    sonListeSatiri = wsListe.Cells(wsListe.Rows.Count, "B").End(xlUp).Row
    sonucSatiri = 2

    For satir = 2 To sonListeSatiri
        ekipmanNo = Trim$(CStr(wsListe.Cells(satir, "B").Value))
        teknikTaniticiNo = Trim$(CStr(wsListe.Cells(satir, "C").Value))
        ekipmanTipi = Trim$(CStr(wsListe.Cells(satir, "D").Value))
        If Len(ekipmanNo) > 0 And Len(teknikTaniticiNo) > 0 Then
            toplamEkipman = toplamEkipman + 1
            pdfSayisi = 0
            dokumanSayisi = 0
            ilkPdf = vbNullString

            For Each pdfYolu In dokumanDosyalari
                If DosyaTeknikTaniticiyaAit(CStr(pdfYolu), teknikTaniticiNo) Then
                    dokumanSayisi = dokumanSayisi + 1
                    If LCase$(Mid$(CStr(pdfYolu), InStrRev(CStr(pdfYolu), ".") + 1)) = "pdf" Then
                        pdfSayisi = pdfSayisi + 1
                        If Len(ilkPdf) = 0 Then ilkPdf = CStr(pdfYolu)
                    End If
                End If
            Next pdfYolu

            If pdfSayisi > 0 Then eslesenEkipman = eslesenEkipman + 1

            wsSonuc.Cells(sonucSatiri, "A").Value = "PETKIM"
            wsSonuc.Cells(sonucSatiri, "B").NumberFormat = "@"
            wsSonuc.Cells(sonucSatiri, "B").Value = ekipmanNo
            wsSonuc.Cells(sonucSatiri, "C").NumberFormat = "@"
            wsSonuc.Cells(sonucSatiri, "C").Value = teknikTaniticiNo
            wsSonuc.Cells(sonucSatiri, "D").Value = vbNullString
            wsSonuc.Cells(sonucSatiri, "E").Value = IIf(pdfSayisi > 0, "Var", "Yok")
            wsSonuc.Cells(sonucSatiri, "F").Value = pdfSayisi
            wsSonuc.Cells(sonucSatiri, "G").Value = dokumanSayisi
            wsSonuc.Cells(sonucSatiri, "H").Value = IIf(pdfSayisi > 0, anaKlasor, vbNullString)
            wsSonuc.Cells(sonucSatiri, "I").Value = ilkPdf
            wsSonuc.Cells(sonucSatiri, "J").Value = Now
            wsSonuc.Cells(sonucSatiri, "J").NumberFormat = "dd.mm.yyyy hh:mm"

            anahtar = NormalizeEquipmentNo(ekipmanNo)
            If manuelBilgiler.Exists(anahtar) Then
                eskiBilgi = manuelBilgiler(anahtar)
                wsSonuc.Cells(sonucSatiri, "K").Value = eskiBilgi(0)
                wsSonuc.Cells(sonucSatiri, "L").Value = eskiBilgi(1)
            End If

            wsSonuc.Cells(sonucSatiri, "M").Value = ekipmanTipi
            sonucSatiri = sonucSatiri + 1
        End If

        If satir Mod 20 = 0 Then
            Application.StatusBar = "Petkim ekipmanlari kontrol ediliyor: " & _
                (satir - 1) & " / " & (sonListeSatiri - 1)
            DoEvents
        End If
    Next satir

    wsAyar.Range("B2").Value = Now
    wsAyar.Range("B2").NumberFormat = "dd.mm.yyyy hh:mm"
    SonucSayfasiniBicimlendir wsSonuc, sonucSatiri - 1

    Application.StatusBar = False
    Application.EnableEvents = True
    Application.ScreenUpdating = True

    MsgBox "Tarama tamamlandi." & vbCrLf & _
        "Kontrol edilen ekipman: " & toplamEkipman & vbCrLf & _
        "Klasordeki PDF: " & toplamPdf & vbCrLf & _
        "Klasordeki toplam dokuman: " & toplamDokuman & vbCrLf & _
        "Rapor bulunan ekipman: " & eslesenEkipman, vbInformation
    Exit Sub

Hata:
    Application.StatusBar = False
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    MsgBox "Tarama sirasinda hata olustu:" & vbCrLf & Err.Description, vbCritical
End Sub

Private Function DosyaTeknikTaniticiyaAit(ByVal dosyaYolu As String, ByVal teknikTaniticiNo As String) As Boolean
    Dim dosyaAdi As String

    dosyaAdi = Mid$(dosyaYolu, InStrRev(dosyaYolu, "\") + 1)
    DosyaTeknikTaniticiyaAit = InStr(1, NormalizeToken(dosyaAdi), NormalizeToken(teknikTaniticiNo), vbTextCompare) > 0
End Function

Private Function NormalizeEquipmentNo(ByVal value As String) As String
    NormalizeEquipmentNo = NormalizeToken(value)
End Function

Private Function NormalizeToken(ByVal value As String) As String
    Dim temiz As String
    temiz = UCase$(Trim$(value))
    temiz = Replace(temiz, " ", vbNullString)
    temiz = Replace(temiz, "-", vbNullString)
    temiz = Replace(temiz, "_", vbNullString)
    temiz = Replace(temiz, ".", vbNullString)
    temiz = Replace(temiz, "(", vbNullString)
    temiz = Replace(temiz, ")", vbNullString)
    NormalizeToken = temiz
End Function

Private Sub AyarlarButonlariniOlustur()
    Dim ws As Worksheet
    Dim btn As Button

    Set ws = ThisWorkbook.Worksheets(SETTINGS_SHEET)
    On Error Resume Next
    ws.Buttons("btnKlasorSec").Delete
    ws.Buttons("btnPDFTara").Delete
    On Error GoTo 0

    Set btn = ws.Buttons.Add(ws.Range("A5").Left, ws.Range("A5").Top, 145, 32)
    btn.Name = "btnKlasorSec"
    btn.Caption = "1. Klasor Sec"
    btn.OnAction = "KlasorSec"

    Set btn = ws.Buttons.Add(ws.Range("C5").Left, ws.Range("C5").Top, 180, 32)
    btn.Name = "btnPDFTara"
    btn.Caption = "2. PDF Raporlarini Tara"
    btn.OnAction = "PDFRaporlariniTara"
End Sub

Private Sub SonucSayfasiniBicimlendir(ByVal ws As Worksheet, ByVal sonSatir As Long)
    With ws
        .Rows(1).Font.Bold = True
        .Rows(1).Interior.Color = RGB(15, 23, 42)
        .Rows(1).Font.Color = RGB(255, 255, 255)
        .Columns("A:A").ColumnWidth = 12
        .Columns("B:B").ColumnWidth = 16
        .Columns("C:D").ColumnWidth = 16
        .Columns("E:G").ColumnWidth = 18
        .Columns("H:I").ColumnWidth = 48
        .Columns("J:L").ColumnWidth = 22
        .Columns("M:M").ColumnWidth = 32
        If sonSatir >= 2 Then
            .Range("A1:M" & sonSatir).Borders.LineStyle = xlContinuous
            If .AutoFilterMode Then .AutoFilterMode = False
            .Range("A1:M" & sonSatir).AutoFilter
        End If
    End With
End Sub
