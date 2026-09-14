GLASS SCORE V3
==============

GLASS SCORE, kort tableti + hakem telefonu + TV/skor ekranı + kulüp panelini gerçek zamanlı senkronize eden padel skor sistemidir.

MARKA
- Ana lacivert: #071321
- GLASS lime: #BDF756
- Beyaz: #FFFFFF
- Logo: public/glass-score-logo.svg

ÖZELLİKLER
- Kort tableti büyük skor kontrolü
- Hakem modu
- Salt-okunur TV / skor ekranı
- Çoklu kort yönetimi
- 0/15/30/40, Deuce, Advantage
- Golden Point
- 6-6 tie-break
- Best of 3 veya tek set
- 4 oyunculu servis sırası
- Servis düzeltme
- Geri alma ve taraf değiştirme
- Duraklat / devam
- Maç süresi ve kalan kort süresi
- Maç geçmişi
- Canlı cihaz senkronizasyonu (SSE)

LOKAL ÇALIŞTIRMA
Node.js 18+ gerekir.

  npm start

veya

  node server.js

Sonra:
  http://localhost:8080

Aynı Wi-Fi cihazları terminalde gösterilen yerel IP adresini kullanabilir.

RENDER DEPLOY
Bu klasör Render'a hazırdır. Private GitHub reposuna dosyaların TAMAMINI yükle.
Render > New Web Service > private repo seç.
Build Command: npm install
Start Command: npm start
Instance: Free (demo için)

Not: Render Free disk kalıcılığı garanti etmez. Demo için uygundur. Gerçek kulüp kullanımında veritabanı kullanılmalıdır.
