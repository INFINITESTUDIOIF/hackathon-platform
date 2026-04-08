import { createClient } from 'npm:@supabase/supabase-js@2'

type Payload = {
  email: string
  password: string
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(500, { error: 'Missing Supabase environment variables' })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json(401, { error: 'Missing Authorization header' })
  }

  let payload: Payload
  try {
    payload = (await req.json()) as Payload
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const email = normalizeEmail(payload.email ?? '')
  const password = String(payload.password ?? '')

  if (!email || !email.includes('@')) {
    return json(400, { error: 'Invalid email' })
  }

  if (password.length < 6) {
    return json(400, { error: 'Password must be at least 6 characters' })
  }

  // verify admin
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const {
    data: { user: caller },
    error: callerErr,
  } = await callerClient.auth.getUser()

  if (callerErr || !caller) {
    return json(401, { error: 'Unauthorized' })
  }

  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .maybeSingle()

  const role = callerProfile?.role

  if (role !== 'admin' && role !== 'main_admin') {
    return json(403, { error: 'Forbidden' })
  }

  // create judge
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createErr || !created.user) {
    return json(400, { error: createErr?.message })
  }

  const judgeId = created.user.id

  const { error: insertErr } = await adminClient.from('profiles').insert({
    id: judgeId,
    email,
    username: email.split('@')[0],
    role: 'judge',
    is_approved: true,
    onboarding_complete: true,
  })

  if (insertErr) {
    return json(400, { error: insertErr.message })
  }

  return json(200, { ok: true })
})