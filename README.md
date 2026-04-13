# Kahoot KZ (Next.js + Supabase)

Kahoot-like quiz platform implemented from the provided technical spec, using:

- Next.js App Router + Tailwind
- Supabase Auth, Database, Realtime, and Storage
- Framer Motion
- Drag-and-drop image upload + browser compression

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add environment variables:

```bash
cp .env.example .env.local
```

Set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **Email sign-up:** In the Supabase dashboard open **Authentication → Providers → Email** and turn off **Confirm email** if you want accounts to work immediately without a confirmation link.

4. In Supabase SQL editor, run:

- `supabase/schema.sql`

5. In Supabase Storage, create public bucket:

- `quiz-images`

6. Start app:

```bash
npm run dev
```

## App Routes

- `/auth` - email/password auth + guest nickname
- `/dashboard` - quiz CRUD and question creation with image upload
- `/host` - create live session, control `current_question`, end session
- `/join` - join by code
- `/play` - realtime question view + response submit + leaderboard

## Notes

- No Express backend is used; all CRUD/realtime/storage is Supabase-native.
- Realtime subscriptions listen to updates in `sessions` and inserts in `responses`.
