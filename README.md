# MOC Takip Dashboard

Enstrüman Bakım Müdürlüğü için MOC, yasal bakım, SCE, Enerji Kritik, SAT,
RCA ve merkezi mesai takibi uygulaması.

## Yerel geliştirme

```bash
npm install
npm run dev
```

Mesai Takibi bağlantısı için `.env.example` dosyasını `.env.local` olarak
kopyalayın ve Supabase proje URL'si ile publishable anahtarını girin.
`service_role` anahtarı tarayıcı uygulamasında kullanılmaz.

## Doğrulama

```bash
npm run verify
```

Bu komut lint kontrolünü, otomatik testleri ve üretim derlemesini birlikte
çalıştırır. Supabase kurulum, migrasyon ve veri doğrulama adımları
[`supabase/README.md`](supabase/README.md) dosyasında yer alır.

## GitHub Pages

`main` dalına gönderilen değişiklikler `.github/workflows/deploy-pages.yml`
iş akışıyla yayınlanır. Repository **Settings → Secrets and variables →
Actions** bölümünde şu iki secret tanımlanmalıdır:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

İş akışı bu değerleri doğrular, `npm run verify` komutunu çalıştırır ve yalnızca
başarılı sonuçta `dist` çıktısını GitHub Pages'e gönderir.
