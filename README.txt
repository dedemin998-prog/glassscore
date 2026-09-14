GLASS SCORE V6
==============

V6 RESPONSIVE HARDENING
- Telefon (320-700px) için tüm ana ekranlar yeniden ölçeklendi.
- Tablet portrait ve landscape için ayrı düzen eklendi.
- Mobil skor ekranında yatay taşma engellendi.
- Hakem modu, kurulum modalı, sponsor alanı, kulüp kartları ve admin ekranı mobil uyumlu hale getirildi.
- iPhone input zoom sorunu önlendi (16px form kontrolleri).
- Sponsorsuz maçta sponsor alanı sıfır yer kaplamaya devam eder.
- Çok sponsor mobilde 2 sütunlu güvenli grid kullanır.
- Kısa yatay telefon görünümü için ayrı kompakt skor düzeni eklendi.

GLASS SCORE V5
==============

Render-ready live padel scoring system.

V5 YENILIKLERI / KONTROLLER
- Kort silme eklendi. Kort yönetiminden onay vererek kort ve geçmişi silinebilir.
- Kort ID'leri artık silinen numarayı tekrar kullanmaz; eski linklerle karışma riski azaltıldı.
- Sponsorsuz maçlar açıkça desteklenir; sponsor alanı hiç render edilmez ve skor ekranı tam alanı kullanır.
- Sponsorlu maçlarda 1-6 logo desteklenir; mobilde logolar sarılarak taşma azaltılır.
- Sponsor verisi her puanda tekrar canlı yayına gönderilmez; mobil veri ve ücretsiz sunucu yükü azaltıldı.
- PDF sponsor için desteklenmeyen tarayıcılarda fallback görünümü eklendi.
- Mobil header sıkışması azaltıldı; Bağlantılar / Maç Ayarı butonları dar ekranda kompakt hale gelir.
- Telefon, tablet, masaüstü ve yatay düşük-yükseklik ekranlar için responsive breakpoint'ler yeniden gözden geçirildi.
- Maç bitişinden sonra Geri Al kullanıldığında geçmişte çift maç kaydı oluşabilen durum düzeltildi.
- Sponsor sürüm takibi eklendi; sponsor değişince bağlı cihazlar yeni logoları bir kez yeniden alır.
- TR / EN, takım/kort/oyuncu adları, Golden Point/Advantage, servis sırası, tie-break, süreler ve canlı senkron korunur.

TEST EDILENLER
- Node.js syntax: server + frontend geçti.
- API: kort ekleme ve silme geçti.
- Skor: 0/15/30/40, Deuce/Advantage ve Golden Point geçti.
- Set/maç bitişi ve final puanını geri alma/geçmiş düzeltmesi geçti.
- 6-6 tie-break ve servis rotasyonu geçti.
- Sponsorlu ve sponsorsuz state akışı kontrol edildi.

RENDER
Build Command: npm install
Start Command: npm start

GITHUB GUNCELLEME
Repo kökünde server.js, package.json, render.yaml, README.txt ve .gitignore bulunur.
public klasöründe index.html ve glass-score-logo.svg bulunur.
GitHub main branch'e değişiklikler commit edilince Render otomatik deploy eder.

URETIM ONCESI KRITIK NOTLAR
1) Render Free planında data.json kalıcı disk garantisi vermez. Demo için uygundur; gerçek kulüp kullanımında PostgreSQL gibi kalıcı veritabanı gerekir.
2) Mevcut demo sürümünde admin/hakem PIN veya kullanıcı girişi yoktur. Linki bilen biri kontrol ekranlarına erişebilir. Halka açık gerçek kullanım öncesi yetkilendirme eklenmelidir.
3) Sponsorlar şu an base64 olarak maç verisinde tutulur. Canlı yayın yükü optimize edildi; ancak çok büyük ve çok sayıda dosya için üretimde object storage (S3/R2 vb.) daha doğru mimaridir.
