# تفعيل نشر آراء الزوار للجميع

قسم الآراء جاهز للحفظ الفوري عبر Cloudflare Pages Functions وقاعدة D1. الموقع ما زال منشورًا على GitHub Pages؛ هذه الاستضافة لا تشغّل وظائف الخادم، لذلك لن يظهر الإرسال للجميع حتى تنقل النشر إلى Cloudflare Pages وتُنشئ قاعدة D1. لا توجد قاعدة إنتاج أو إعدادات Cloudflare مؤكدة في ملفات المشروع الآن.

## إعداد الإنتاج مرة واحدة

1. من لوحة Cloudflare افتح **Workers & Pages → D1 SQL Database → Create database**، وأنشئ قاعدة باسم `yusuf-dessouky-reviews`. انسخ معرّف القاعدة الحقيقي.
2. في `wrangler.toml` استبدل القيمة الصفرية في `database_id` بمعرّف قاعدة D1 الذي أنشأته. القيمة الحالية مؤقتة وليست معرّف قاعدة حقيقية.
3. افتح **Workers & Pages → Create application → Pages → Connect to Git**، واختر مستودع الموقع. إعداد البناء:
   - Framework preset: `None`
   - Build command: اتركه فارغًا
   - Build output directory: `.`
   - Root directory: المجلد الذي يحتوي `index.html` و`functions/` و`wrangler.toml`
4. في مشروع Pages افتح **Settings → Bindings → Add → D1 database**. اختر قاعدة `yusuf-dessouky-reviews` واكتب اسم الربط `DB`، ثم أعد النشر.
5. من مجلد المشروع، بعد تثبيت Node.js وتسجيل الدخول إلى Cloudflare عبر Wrangler، طبّق مخطط قاعدة الإنتاج:

   ```powershell
   npx wrangler d1 migrations apply yusuf-dessouky-reviews --remote
   ```

6. أنشئ سرًا عشوائيًا محليًا:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

   أضف الناتج في Cloudflare Pages من **Settings → Variables and Secrets → Add → Secret** باسم `RATE_LIMIT_SECRET` لبيئة Production، ثم أعد النشر. لا تضع السر في `index.html` أو أي ملف عام. يستخدمه الخادم لحماية حد الإرسال، ولا يُستخدم لتسجيل دخول أو إدارة.

7. افتح رابط Cloudflare Pages وجرّب إرسال رأي. بعد نجاحه سيظهر فورًا للزوار الآخرين. عند ربط نطاقك الحالي بـ Cloudflare Pages، حدّث عنوان النطاق الأساسي في `index.html` و`privacy.html` و`sitemap.xml` و`robots.txt` إذا تغير العنوان.

## اختبار محلي

1. أنشئ ملف `.dev.vars` بجوار `wrangler.toml` وضع فيه سرًا محليًا للاختبار فقط:

   ```dotenv
   RATE_LIMIT_SECRET=ضع_هنا_سرًا_عشوائيًا_بطول_32_بايتًا_على_الأقل
   ```

   الملف مستثنى من Git بواسطة `.gitignore`.
2. طبّق المخطط محليًا وشغّل الموقع:

   ```powershell
   npx wrangler d1 migrations apply yusuf-dessouky-reviews --local
   npx wrangler pages dev . --ip 127.0.0.1 --port 8788
   ```

3. افتح `http://127.0.0.1:8788`، أرسل رأيًا، ثم حدّث الصفحة وتأكد من بقائه ظاهرًا. أرسل رأيًا ثانيًا من جلسة متصفح أخرى وتأكد من ظهوره فيها أيضًا. اختبر رفض النص الأقصر من 3 أحرف، وإرسال أكثر من 5 آراء خلال الساعة من عنوان الاتصال نفسه. قاعدة الاختبار محلية ولا تتصل بقاعدة الإنتاج.

## حذف رأي بعد نشره

لا توجد مراجعة أو لوحة إدارة. إذا احتجت حذف رأي، افتح **D1 → قاعدة `yusuf-dessouky-reviews` → Console**، اعثر على معرّفه من نتيجة الاستعلام التالية، ثم احذفه:

```sql
SELECT id, name, message, created_at FROM reviews ORDER BY created_at DESC;
DELETE FROM reviews WHERE id = 'ضع-معرف-الرأي-هنا';
```

يقتصر الحد على 5 محاولات إرسال من عنوان الاتصال في الساعة. لا يُحفظ عنوان IP الخام؛ يُستخدم HMAC مؤقت لتحديد المعدل، ويُحذف سجل الحد بعد انتهاء مدته عند الطلبات التالية.
