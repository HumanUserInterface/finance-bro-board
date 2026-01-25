import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
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
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes
  const protectedPaths = ['/dashboard', '/budget', '/deliberate', '/history', '/board', '/settings'];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from auth pages
  const authPaths = ['/login', '/signup'];
  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isAuthPath && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Check onboarding status for authenticated users
  if (user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single() as any);

    const isOnboardingPath = request.nextUrl.pathname.startsWith('/onboarding');
    const onboardingCompleted = profile?.onboarding_completed ?? false;

    // Only enforce onboarding for truly new users (no data at all)
    // Check if user has any existing data
    if (!onboardingCompleted && isProtectedPath && !isOnboardingPath) {
      // Check if they have any income sources or expenses (existing user with data)
      const { data: incomes } = await supabase
        .from('income_sources')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      const { data: expenses } = await supabase
        .from('expenses')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      // Only redirect to onboarding if they have NO data (truly new user)
      const hasData = (incomes && incomes.length > 0) || (expenses && expenses.length > 0);

      if (!hasData) {
        const url = request.nextUrl.clone();
        url.pathname = '/onboarding';
        return NextResponse.redirect(url);
      }
    }

    // If onboarding completed and trying to access onboarding page, redirect to dashboard
    if (onboardingCompleted && isOnboardingPath) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
