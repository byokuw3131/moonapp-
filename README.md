# 🌙 MoonApp - Gerçek Zamanlı (Real-Time) Web Sohbet Uygulaması

WhatsApp Web tasarımından ve modern derin gece (OLED siyah) estetiğinden ilham alan, gerçek zamanlı ve çok kullanıcılı (multiplayer) mesajlaşma web uygulaması.

---

## ✨ Özellikler

- 🖤 **WhatsApp Web Dark & OLED Tasarımı:** Gözü yormayan derin siyah/gece tonları, modern cam (glassmorphism) efektleri ve ay ışığı mavisi/yeşil aksanlar.
- ⚡ **Gerçek Zamanlı Hızlı Mesajlaşma:** Socket.IO altyapısı ile sıfır gecikmeli mesaj iletimi.
- 👥 **Çok Kullanıcılı (Multiplayer) & Özel Sohbet:**
  - **🌙 Moon Genel Sohbet:** Herkesin dahil olduğu genel topluluk odası.
  - **1'e 1 Özel Mesajlaşma (DM):** İstediğiniz kullanıcının profiline tıklayıp anında gizli ve özel sohbet başlatma.
- 🟢 **Canlı Çevrimiçi / Çevrimdışı Durumu:** Kullanıcıların aktiflik durumu anlık güncellenir.
- ✍️ **"Yazıyor..." Göstergesi:** Karşı taraf klavyede yazarken canlı olarak görünür.
- ✔️✔️ **WhatsApp Çift Tik Sistemi:**
  - Tek tik (`✓`): Mesaj sunucuya ve odaya gönderildi.
  - Çift mavi/mor tik (`✓✓`): Karşı taraf mesajı gördü/okudu.
- 🎙️ **Sesli Mesaj (Voice Note):** Bas-konuş tarzı tarayıcı mikrofonuyla ses kaydetme ve WhatsApp benzeri ses oynatıcı dalga çubuğu.
- 🖼️ **Fotoğraf ve Dosya Paylaşımı:** Sürükle-bırak veya ataç butonuyla resim ve belge gönderme, dahili tam ekran resim görüntüleyici (lightbox).
- 🔊 **Synthesized Web Audio Bildirim Sesleri:** WhatsApp tarzı mesaj gönderme ve alma "pop" sesleri (harici ses dosyası gerekmez, internet kesilse dahi çalışır).
- 😀 **Dahili Emoji Menüsü:** 70+ popüler emoji seçeneği.
- 💾 **Kalıcı SQLite Veritabanı:** Sayfa yenilense bile tüm mesajlar, kullanıcılar ve sohbet odaları korunur.
- 📱 **Mobil Uyumlu (Responsive):** Telefondan ve tabletten girildiğinde tam mobil uygulama hissiyatı (sohbet seçildiğinde ekran kayar, geri butonuyla listeye döner).

---

## 🚀 Yerel Olarak Çalıştırma (Kendi Bilgisayarında)

1. Proje klasöründe terminal veya PowerShell açın:
   ```bash
   cd c:\Users\orxan\Desktop\69
   ```

2. Bağımlılıkları kurun (zaten kurulduysa atlayabilirsiniz):
   ```bash
   npm install
   ```

3. Sunucuyu başlatın:
   ```bash
   npm start
   ```

4. Tarayıcınızda açın:
   - **http://localhost:3000**

> **💡 İki Kişilik (Multiplayer) Test:**
> Bir sekmede normal pencere, diğer sekmede **Gizli Pencere (Incognito)** açarak iki farklı isimle (örneğin "Orxan" ve "Ali") giriş yapın. Biri yazdığında diğerinde anında mesajların, seslerin ve "yazıyor..." bildiriminin çalıştığını görebilirsiniz.
> 
> Aynı Wi-Fi ağındaki cep telefonunuzdan bilgisayarınızın yerel IP adresiyle (örneğin: `http://192.168.1.XX:3000`) bağlanıp telefonunuzla bilgisayarınız arasında anlık konuşabilirsiniz!

---

## 🌐 İnternete / Hostinge Yükleme Rehberi (Başkalarıyla Konuşmak İçin)

MoonApp, standart `process.env.PORT` desteğine ve sıfır-konfigürasyon SQLite yapısına sahip olduğu için her türlü bulut platformuna ve hostinge 2 dakikada yüklenebilir:

### 1. Seçenek: Render.com (Ücretsiz & En Kolayı - Tavsiye Edilen)
1. Projeyi bir GitHub deposuna yükleyin (`git push`).
2. [Render.com](https://render.com) adresine ücretsiz üye olun.
3. **New +** > **Web Service** seçin ve GitHub deponuzu bağlayın.
4. Ayarlar:
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. **Create Web Service** butonuna tıklayın.
6. Render size `https://moonapp-xxxx.onrender.com` şeklinde ücretsiz bir bağlantı verecektir. Bu bağlantıyı arkadaşınıza atarak dilediğiniz yerden birlikte sohbet edebilirsiniz!

---

### 2. Seçenek: Railway.app
1. [Railway.app](https://railway.app)'e giriş yapın.
2. **New Project** > **Deploy from GitHub repo** deyin.
3. Railway projeyi otomatik algılar, portu ayarlar ve saniyeler içinde canlıya alır.

---

### 3. Seçenek: Kendi VPS / Linux Sunucunuz (Ubuntu / Debian)
Eğer bir VPS sunucunuz varsa (DigitalOcean, Hetzner, Vultr vb.):
```bash
# Projeyi sunucuya aktarın ve dizine girin
cd /var/www/moonapp
npm install

# PM2 ile arka planda 7/24 çalıştırın
npm install -g pm2
pm2 start server.js --name "moonapp"
pm2 startup
pm2 save
```
Nginx arkasında çalıştırmak için Nginx konfigürasyonunuza WebSocket proxy yönlendirmesini (`proxy_set_header Upgrade $http_upgrade;`) eklemeniz yeterlidir.

---

### 4. Seçenek: cPanel / Plesk Hosting (Setup Node.js App)
cPanel kullanıyorsanız:
1. **cPanel > Setup Node.js App** menüsüne gidin.
2. **Create Application** butonuna tıklayın.
3. Node.js versiyonunu seçin (v18, v20 veya üzeri).
4. Application root olarak proje klasörünüzü, Startup file olarak `server.js` yazın.
5. Dosyaları Dosya Yöneticisi ile yükleyip `Run NPM Install` butonuna basın ve `Restart` deyin.

---

## 📂 Dosya Yapısı

```
├── server.js            # Express + Socket.IO sunucu ve upload API'si
├── database.js          # SQLite veritabanı şeması ve sorgu fonksiyonları
├── moonapp.sqlite       # Kalıcı mesaj ve kullanıcı veritabanı (otomatik oluşur)
├── package.json         # Proje ayarları ve kütüphaneler
├── README.md            # Kurulum ve hosting rehberi
└── public/              # Kullanıcı arayüzü dosyaları
    ├── index.html       # WhatsApp düzeninde şık arayüz ve modallar
    ├── style.css        # WhatsApp Dark OLED karanlık tema stilleri
    ├── app.js           # Gerçek zamanlı sohbet, ses kaydı, çift tik mantığı
    ├── sounds.js        # Web Audio bildirim sesleri
    └── uploads/         # Gönderilen resim, ses ve dosya deposu
```
