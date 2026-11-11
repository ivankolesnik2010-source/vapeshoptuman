# Туман: демо-магазин з адмінкою

Express + SQLite (better-sqlite3), чистий HTML/CSS/JS на фронтенді.

## Запуск у VS Code
1. Встановіть Node.js 20 або новіший.
2. Відкрийте папку проєкту у VS Code, у терміналі:
   ```
   npm install
   cp .env.example .env      # Windows: copy .env.example .env
   ```
3. У `.env` задайте `ADMIN_PASSWORD` і `SESSION_SECRET`
   (випадковий рядок: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
4. `npm run dev`, потім відкрийте:
   - магазин: http://localhost:3000
   - адмінка: http://localhost:3000/admin

## Що вміє адмінка
- додавати, змінювати, приховувати й видаляти товари;
- завантажувати фото товарів (JPG, PNG, WebP до 3 МБ);
- переглядати замовлення й міняти їхній статус.

## Структура
- `server.js`: API, база даних, авторизація, завантаження фото
- `public/`: сайт (`index.html`, `app.js`) і адмінка (`admin.html`, `admin.js`), спільний `style.css`
- `data/shop.db`: база (створюється автоматично, у git не потрапляє)

## Перед публікацією
- Використайте HTTPS і `NODE_ENV=production` (тоді cookie отримує прапорець Secure).
- Використовуйте довгий унікальний `ADMIN_PASSWORD`.
- Робіть резервні копії `data/shop.db` і `public/uploads/`.
- Перевірте місцеві правила продажу та реклами нікотинової продукції й вимоги платіжних систем.
