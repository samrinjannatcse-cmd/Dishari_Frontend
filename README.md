# Dishari Frontend (React + Vite + TypeScript + Tailwind)

The Dishari website: a landing page with a 3D scroll story, plus screens for every role (admin, teacher, moderator, student, parent). The whole UI is in Bangla and English.

## চালানোর নিয়ম

আগে backend চালু করুন (`D:\Dishari Backend` → `docker compose up`)। তারপর নিচের যেকোনো একটা উপায়ে frontend চালান।

**উপায় ১: Docker (Node লাগবে না)**

```powershell
cd "D:\Dishari Frontend"
docker compose up --build
```

**উপায় ২: Node.js 20+ দিয়ে (কাজ করার সময় এটা ভালো, কোড বদলালে সাথে সাথে দেখা যায়)**

```powershell
cd "D:\Dishari Frontend"
npm install
npm run dev
```

দুই উপায়েই খুলুন http://localhost:5173। Demo login (password `Dishari@123`): `teacher@`, `moderator@`, `student@`, `admin@`, `parent@` + `dishari.com`। Development mode-এ login page-এ এগুলো এক ক্লিকে বসানো যায়।

Backend অন্য ঠিকানায় থাকলে `.env` file-এ `VITE_API_URL` বদলান।

## Structure

| Path | What |
|---|---|
| `src/api/client.ts` | One HTTP client. It adds the JWT, refreshes the token on `TOKEN_EXPIRED`, and turns every error into the backend's `{code, message, fields}` shape. It also has the `download()` and `openHtml()` helpers. |
| `src/api/schema.d.ts` | Types generated from the backend OpenAPI. Regenerate them with `npm run gen:api` while the backend is running. |
| `src/api/hooks.ts` | React Query hooks: taxonomy (cached), questions, dashboard and ML status. |
| `src/auth/Auth.tsx` | Login state, roles and the `RequireAuth` route guard. |
| `src/i18n/strings.ts` | Every label as `[English, বাংলা]`. Add a key there, then use `t("key")`. |
| `src/i18n/I18n.tsx` | Language switch (saved per browser), Bangla digits `n()`, and `pick()` for name_en/name_bn. |
| `src/three/OrbitScene.tsx` | WebGL "guiding star" scene built from the logo. Questions settle into four K1–K4 orbits, then gather into one star. It is lazy-loaded and pauses when off screen. |
| `src/motion/index.tsx` | Motion kit: `Reveal` (word by word, safe for Bangla), `CountUp`, `Tilt` (3D card tilt), `Magnetic`, `Page` transitions, `Ribbons` backdrop and `useLenis` smooth scroll. |
| `src/components/ui.tsx` | Button, Field, Input, Select, badges (level/difficulty/status), confidence bar, Modal/Drawer, Tabs, Toast, FileDrop, Stat, Skeleton, Empty. |
| `src/layout/AppShell.tsx` | Top bar, role-based side menu, mobile bottom bar, language toggle and model status. |
| `src/pages/*` | One file per screen (see the route list in `src/main.tsx`). |

## Screens → backend

| Screen | Route | API |
|---|---|---|
| Landing | `/` | (none) |
| Login / register / forgot / reset | `/login` `/register` `/forgot-password` `/reset-password` | `/auth/*` |
| Dashboard (all roles) | `/app` | `/dashboard` |
| Tag question | `/app/tag` | `/questions/tag`, `/board-questions/check`, `/questions/{id}/image` |
| Bulk upload | `/app/bulk` | `/bulk/*` |
| Question bank + detail | `/app/questions`, `/app/questions/:id` | `/questions*`, `/tag-reports` |
| Papers + builder | `/app/papers`, `/app/papers/:id` | `/papers*` (export to Word, Print/PDF or Excel) |
| Review queue | `/app/review` | `/reviews/*`, `/tag-reports` |
| Practice → play → result | `/app/practice`, `/app/practice/:id`, `/app/practice/:id/result` | `/practice/sessions*` |
| Progress (student) / children (parent) | `/app/progress`, `/app/children` | `/students/{id}/progress`, `/students/{id}/mastery`, `/parents/me/children` |
| Administration | `/app/admin?tab=users\|taxonomy\|board\|models\|audit` | `/users`, `/taxonomy`, `/board-questions`, `/admin/*`, `/ml/agreement` |

## Design rules (from the style guide)

- **Colours:** maroon `#7A0F1E` for the primary action, gold `#B8892B` only for accents. All colour tokens are in `tailwind.config.js`.
- **Fonts:** Inter and Hind Siliguri. Bangla UI uses line-height ≥ 1.6 and Bangla digits.
- **Accessibility:**
  - Letter-spacing is switched off in Bangla, because it breaks conjuncts.
  - Badges always carry text, not only colour.
  - There is a visible gold focus ring.
  - Buttons are 44px tall.
- **Motion:** everything respects `prefers-reduced-motion`. The 3D scene falls back to the logo if WebGL is missing.
