# Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → **New query**.
3. Paste the full contents of `schema.sql` and click **Run**.
4. **Authentication** → **Providers** → enable **Google** and set client ID/secret from Google Cloud Console.
5. **Authentication** → **URL Configuration**:
   - **Site URL**: `http://localhost:5173` during dev; your production URL for deploy.
   - **Redirect URLs**: add `http://localhost:5173/**` and `https://YOUR_DOMAIN/**`.
6. Copy **Project URL** and **anon public** key into `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (this app uses Vite, not Next — use the `VITE_` prefix).
7. Set `VITE_MAIN_ADMIN_EMAILS` to your Google account email so the first login becomes a `main_admin`.

Then run the app and sign in. Participants will see **Waiting for admin approval** until approved in `/admin`.
