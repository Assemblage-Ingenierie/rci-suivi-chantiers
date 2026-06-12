import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes accessibles sans session. */
const ROUTES_PUBLIQUES = ["/connexion", "/inscription"];

/**
 * Rafraîchit la session Supabase (pattern officiel @supabase/ssr) et applique
 * les redirections d'authentification de base. Les contrôles de rôle et de
 * statut de compte sont faits dans les layouts serveur.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT : ne rien insérer entre createServerClient et getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cheminPublic = ROUTES_PUBLIQUES.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (!user && !cheminPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && cheminPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
