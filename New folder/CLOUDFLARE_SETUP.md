# تشغيل آراء الزوار على Cloudflare

المشروع الحالي منشور على GitHub Pages، وهي استضافة ثابتة لا تشغّل Cloudflare Pages Functions. جهزت الملفات المطلوبة، لكن استقبال الآراء لن يعمل فعليًا حتى تنشر الموقع على Cloudflare Pages وتربط D1. لا توجد قاعدة D1 أو أسرار Cloudflare في المشروع الآن.

## إعداد Cloudflare مرة واحدة

1. أنشئ قاعدة D1 باسم `yusuf-dessouky-reviews` من لوحة Cloudflare، ثم انسخ معرّفها إلى `database_id` في `wrangler.toml` بدل المعرّف الصفري المؤقت.
2. أنشئ Pages project متصلًا بمستودع الموقع. اختر `None` كإطار عمل، واترك أمر البناء فارغًا، واجعل مجلد الملفات المنشأة `.`. يجب أن يكون جذر المشروع هو مجلد `index.html` و`functions/`.
3. استخدم ربط D1 الموجود في `wrangler.toml`، أو أضفه من **Workers & Pages → مشروع Pages → Settings → Bindings → Add → D1 database** باسم المتغير `DB` واختر القاعدة التي أنشأتها. أعد النشر بعد تغيير الربط. لا توصل معاينات الفروع بقاعدة الإنتاج؛ إذا احتجت المعاينة، أنشئ لها قاعدة وأسرارًا منفصلة.
4. طبّق مخطط القاعدة على قاعدة الإنتاج من جهاز موثوق:

   ```powershell
   npx wrangler d1 migrations apply yusuf-dessouky-reviews --remote
   ```

5. من Cloudflare Pages project افتح **Settings → Variables and Secrets → Add** واختر نوع **Secret**، ثم أضف القيمتين لبيئة Production. لا تضفهما إلى `index.html` أو أي ملف عام:
   - `ADMIN_PASSWORD`: كلمة إدارة قوية بطول 16 محرفًا على الأقل.
   - `SESSION_SECRET`: سر عشوائي بطول 32 بايت على الأقل.

   يمكن توليد قيمة عشوائية محليًا باستخدام `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. أعد النشر بعد حفظ الأسرار.
6. افتح `/admin.html`، سجّل الدخول، وتأكد من قبول رسالة تجريبية ثم رفض رسالة أخرى. لن تظهر الرسائل إلا بعد قبولها.
7. عند الانتقال من عنوان GitHub Pages إلى نطاق Cloudflare Pages، حدّث عنوان النطاق الأساسي في `index.html` و`privacy.html` و`sitemap.xml` و`robots.txt` إذا تغير عنوان الموقع.

## اختبار محلي مع D1 محلية

1. أنشئ ملفًا محليًا اسمه `.dev.vars` بجوار `wrangler.toml`، وضع فيه قيم اختبار غير مستخدمة في الإنتاج:

   ```dotenv
   ADMIN_PASSWORD=ضع_هنا_كلمة_مرور_محلية_للاختبار
   SESSION_SECRET=ضع_هنا_سرًا_محليًا_عشوائيًا_بطول_32_بايتًا_على_الأقل
   ```

   الملف مستثنى من Git بواسطة `.gitignore`.
2. طبّق المخطط محليًا ثم شغّل Pages Functions:

   ```powershell
   npx wrangler d1 migrations apply yusuf-dessouky-reviews --local
   npx wrangler pages dev . --ip 127.0.0.1 --port 8788
   ```

3. افتح `http://127.0.0.1:8788` واختبر إرسال رأي، ثم افتح `/admin.html` واقبله أو ارفضه. قاعدة الاختبار محلية ولا تتصل بإنتاج Cloudflare.

معدل الإرسال محدود بخمس رسائل لكل عنوان اتصال خلال ساعة. لا يُخزن عنوان IP الخام؛ تستخدم الوظيفة تجزئة HMAC مؤقتة لتطبيق الحد، وتحذف السجلات المنتهية عند الطلبات اللاحقة. رسائل الرفض تبقى في D1 حتى حذفها نهائيًا من لوحة الإدارة.
