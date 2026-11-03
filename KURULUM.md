# USOAP CMA Faz 1 GitHub ve Firebase kurulumu

Bu paket 851 PQ kaydını ve kaynak belgelerini içerir. Altı geçici kaldırma notu ayrı tutulur. Yerel kullanım Google ile giriş gerektirmez; Firebase'e kayıt için yapılandırma gerekir. Firebase henüz kullanıcı projesine bağlanmamıştır.

## 1 GitHub Pages

1. GitHub'da bu uygulamaya ayrılmış bir depo oluşturun veya kullanılacak mevcut depoyu belirleyin.
2. Paketin içeriğini depo köküne yerleştirin: `web`, `.github`, `firestore.rules`, `firebase.json`, `tests.mjs` ve bu rehber. ZIP dosyasını değil, çıkarılmış dosyaları yükleyin. `web` klasörünü aynı isimle koruyun.
3. Deponun **Settings > Pages** bölümünde kaynak olarak **GitHub Actions** seçin.
4. Varsayılan dal `main` olmalı. Başka dal kullanılacaksa `.github/workflows/pages.yml` içindeki `branches` değerini değiştirin.
5. Actions iş akışı tamamlandığında Pages adresini açın. Uygulama yerel kullanım durumunda 851 soruyu gösterecektir. Giriş veya bulut yazması yapılandırılmadan etkinleşmez.

GitHub Pages'e koyulan `web` içeriği, `data.json` ve `sources` belgeleri yayımlanan statik dosyalardır. Ülke bulguları, CAP'ler ve kişisel kayıtlar bu dosyalara konulmamalıdır. Bu paket henüz GitHub'a yüklenmemiştir.

## 2 Firebase projesi

1. Firebase Console'da bu uygulamaya ait proje oluşturun veya kullanılacak mevcut projeyi seçin.
2. **Project settings > Your apps** bölümünden bir Web uygulaması ekleyin.
3. Firebase Web yapılandırmasındaki `apiKey`, `authDomain`, `projectId`, `appId` değerlerini alın. `storageBucket` ve `messagingSenderId` varsa korunabilir. Servis hesabı JSON dosyasını veya `private_key` değerini kullanmayın.
4. **Authentication > Sign-in method** bölümünde Google sağlayıcısını etkinleştirin.
5. **Authentication > Settings > Authorized domains** bölümüne Pages adresinin yalnızca alan adını ekleyin. Yol veya `https://` yazmayın.
6. **Firestore Database** oluşturun. Konum tercihini kurumun gereksinimine göre belirleyin. Başlangıçta herkese erişim veren test kurallarını kullanmayın.

## 3 İlk giriş ve UID

1. Pages uygulamasında **Bağlantı ayarları** seçeneğini açın.
2. Yapılandırmayı geçerli JSON olarak girin: anahtarlar ve metinler çift tırnak içinde olmalıdır.

```json
{
  "apiKey": "FIREBASE_WEB_API_KEY",
  "authDomain": "PROJECT_ID.firebaseapp.com",
  "projectId": "PROJECT_ID",
  "appId": "FIREBASE_WEB_APP_ID"
}
```

3. UID alanını ilk seferde boş bırakıp **Bu cihazda kaydet** düğmesine basın ve sayfayı yenileyin.
4. **Google ile giriş** düğmesiyle kendi hesabınızı seçin.
5. **Bağlantı ayarları** ekranında gösterilen Firebase UID değerini kopyalayın. UID boşken hiçbir bulut okuma/yazma işlemi başlatılmaz.
6. UID'yi aynı ekrandaki izin verilen UID alanına yazın; kaydedip sayfayı yenileyin.
7. `firestore.rules` içindeki `BURAYA_KENDI_FIREBASE_UID_DEGERINIZ` metnini aynı UID ile değiştirin. Firestore Console > Rules bölümüne dosyanın tamamını koyup yayımlayın. UID'ye göre erişim veritabanında uygulanır; arayüzdeki kontrol tek başına yetkilendirme değildir.

Ayarların diğer cihazlarda da hazır olması isteniyorsa `web/firebase-config.js` içinde `window.PQ_FIREBASE_CONFIG` değerini Web yapılandırma nesnesi, `window.PQ_ALLOWED_UID` değerini UID olarak doldurup GitHub'a yükleyin. O cihazdaki Bağlantı ayarlarıyla kaydedilmiş ayarlar dosyadaki ayarlara göre önceliklidir.

## 4 Başlangıç setini kaydetme ve kontrol

1. Yetkili hesapla girişten sonra **Setleri buluta kaydet** düğmesine basın. Mevcut set kimliği aynı içerikle varsa tekrar yazılmaz; farklı içerik varsa hata gösterilir ve eski kayıt korunur.
2. Firebase'de `users / UID / pqSets / icao-2024-sep-initial` kaydı ve bunun `chunks` alt koleksiyonu oluşmalıdır.
3. **Buluttan yenile** düğmesiyle sonucu doğrulayın. Uygulama parça sayısı, sırası, SHA-256 bütünlüğü ve PQ şemasını denetler.
4. İkinci cihazda aynı proje ayarları ve aynı Google hesabıyla giriş yapın. Eklenen sürümler buluttan gelmelidir.
5. Yeni JSON sürümünü içe aktardığınızda Firebase bağlıysa doğrudan buluta kaydedilir. Kayıt başarısızsa uygulama kaydedildi bilgisi vermez; tekrar denenebilir.
6. Firebase bağlı değilken yüklenen sürümler yalnızca o tarayıcıya kaydedilir. Bunları JSON olarak dışa aktararak yedekleyin veya bağlantı kurulunca **Setleri buluta kaydet** düğmesini kullanın.

## 5 Sürüm kuralları

Her setin `id` ve `label` bilgisi vardır. Yeni sürüm için ayrı `id` gerekir. Aynı kimlikte farklı içerik üzerine yazılmaz. Firestore kuralları set ve parçaların güncellenmesine/silinmesine izin vermez. Birleştirilen veya bölünen PQ'ların resmî eşleştirmesi bu sürümde otomatik çıkarılmaz. Denetim kayıtları ve bu kayıtlara sabit PQ kopyalama Faz 2 kapsamındadır.

Bu sürüm doğrudan DOCX yüklemez; mevcut dokuz DOCX önceden işlenmiştir. Yeni setlerin uygulama içinden aktarım biçimi JSON'dur.

## 6 Kontroller ve sınırlar

`node tests.mjs` ile veri şeması, 851 PQ, altı kaldırma notu, SSP ayrımı, değişiklik karşılaştırması, bulut parçalama/birleştirme ve bozuk/eksik veri reddi kontrol edilir. JavaScript sözdizimi ve yapılandırılmamış yerel kullanım ekranı da kontrol edilmiştir.

Gerçek Google girişi, Firestore kurallarının emülatör/gerçek proje değerlendirmesi ve cihazlar arası eşitleme, proje bilgileri olmadan doğrulanmamıştır. Kurallar kullanıcı projesinde yayımlanmalı ve yukarıdaki kabul kontrolleri tamamlanmalıdır.

Yerel önizleme için paket kökünde `python -m http.server 8000` çalıştırıp tarayıcıda `/web/` yolunu açabilirsiniz. `index.html` dosyasını çift tıklamak yerine HTTP sunucusu kullanın.

## Resmî başvuru kaynakları

- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
