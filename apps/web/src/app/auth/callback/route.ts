import { createServerClient } from "@supabase/ssr/dist/main/createServerClient";
import { NextResponse } from "next/server";

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/hub";
  let response = NextResponse.redirect(new URL(next, requestUrl.origin));

  if (code) {
    const env = getSupabaseEnv();
    if (!env) {
      return NextResponse.redirect(new URL("/?auth=missing-supabase-env", requestUrl.origin));
    }

    const { supabaseUrl, supabaseAnonKey } = env;
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.headers.get("cookie")
            ?.split(";")
            .map((cookie) => {
              const [name, ...valueParts] = cookie.trim().split("=");
              return { name, value: valueParts.join("=") };
            })
            .filter((cookie) => cookie.name) ?? [];
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      response = NextResponse.redirect(new URL("/?auth=callback-error", requestUrl.origin));
    }
  }

  return response;
}
