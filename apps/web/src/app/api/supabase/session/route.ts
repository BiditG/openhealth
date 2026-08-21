import { NextResponse } from "next/server";

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

function getStorageKey(supabaseUrl: string) {
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

type JwtPayload = {
  sub?: unknown;
  email?: unknown;
  exp?: unknown;
  user_metadata?: unknown;
  app_metadata?: unknown;
  aud?: unknown;
  role?: unknown;
};

function getJwtPayload(accessToken: string) {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as JwtPayload;
  } catch {
    return null;
  }
}

function setChunkedCookie(response: NextResponse, name: string, value: string) {
  const maxChunkSize = 3180;
  const cookieOptions = {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: false,
    maxAge: 400 * 24 * 60 * 60,
  };

  response.cookies.set(name, "", { ...cookieOptions, maxAge: 0 });
  for (let index = 0; index < 8; index += 1) {
    response.cookies.set(`${name}.${index}`, "", { ...cookieOptions, maxAge: 0 });
  }

  if (encodeURIComponent(value).length <= maxChunkSize) {
    response.cookies.set(name, value, cookieOptions);
    return;
  }

  for (let index = 0; index * maxChunkSize < value.length; index += 1) {
    response.cookies.set(
      `${name}.${index}`,
      value.slice(index * maxChunkSize, (index + 1) * maxChunkSize),
      cookieOptions
    );
  }
}

export async function POST(request: Request) {
  const env = getSupabaseEnv();
  if (!env) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as {
    accessToken?: unknown;
    refreshToken?: unknown;
  } | null;

  const accessToken = typeof body?.accessToken === "string" ? body.accessToken : "";
  const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "Missing Supabase session tokens." }, { status: 400 });
  }

  const jwtPayload = getJwtPayload(accessToken);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenExpiresAt = typeof jwtPayload?.exp === "number" ? jwtPayload.exp : null;
  const cookieExpiresAt =
    tokenExpiresAt && tokenExpiresAt > nowSeconds ? tokenExpiresAt : nowSeconds + 60 * 60;
  const now = new Date().toISOString();
  const userId = typeof jwtPayload?.sub === "string" ? jwtPayload.sub : "";
  const email = typeof jwtPayload?.email === "string" ? jwtPayload.email : "";

  if (!userId) {
    return NextResponse.json({ error: "Invalid Supabase access token." }, { status: 401 });
  }

  const sessionPayload = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    expires_in: Math.max(0, cookieExpiresAt - nowSeconds),
    expires_at: cookieExpiresAt,
    user: {
      id: userId,
      aud: typeof jwtPayload?.aud === "string" ? jwtPayload.aud : "authenticated",
      role: typeof jwtPayload?.role === "string" ? jwtPayload.role : "authenticated",
      email,
      email_confirmed_at: now,
      phone: "",
      confirmed_at: now,
      last_sign_in_at: now,
      app_metadata:
        jwtPayload?.app_metadata && typeof jwtPayload.app_metadata === "object"
          ? jwtPayload.app_metadata
          : {},
      user_metadata:
        jwtPayload?.user_metadata && typeof jwtPayload.user_metadata === "object"
          ? jwtPayload.user_metadata
          : {},
      identities: [],
      created_at: now,
      updated_at: now,
      is_anonymous: false,
    },
  };

  const response = NextResponse.json({ ok: true });
  const encoded = `base64-${Buffer.from(JSON.stringify(sessionPayload), "utf8").toString("base64url")}`;
  setChunkedCookie(response, getStorageKey(env.supabaseUrl), encoded);

  return response;
}
