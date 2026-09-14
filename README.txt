GLASS SCORE V7 PERSISTENT
=========================

V6 responsive arayüz korunur. V7 ile Render PostgreSQL kalıcı veri desteği eklenmiştir.

KALICI VERİLER
- Kortlar ve kort isimleri
- Takım / oyuncu isimleri
- Maç ayarları ve canlı skor durumu
- Maç geçmişi
- Sponsor logoları
- Servis sırası, süre ve diğer maç state bilgileri

RENDER
Web Service Environment içine DATABASE_URL eklenmelidir. Değer olarak aynı regiondaki Render PostgreSQL veritabanının Internal Database URL bağlantısı kullanılmalıdır. URL kaynak koda veya GitHub'a yazılmamalıdır.

DATABASE_URL yoksa yerel geliştirmede data.json fallback olarak kullanılır.
