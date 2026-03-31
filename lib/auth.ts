import type { User } from "@supabase/supabase-js";

export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl?: string | null;
};

import { createClient } from "@/lib/server";

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getUserName(user: User) {
  const metadata = user.user_metadata;

  return (
    readString(metadata?.full_name) ??
    readString(metadata?.name) ??
    readString(metadata?.user_name) ??
    readString(metadata?.preferred_username) ??
    (user.email ? user.email.split("@")[0] : null) ??
    "Account"
  );
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return {
    id: data.user.id,
    name: getUserName(data.user),
    email: data.user.email ?? null,
    avatarUrl:
      readString(data.user.user_metadata?.avatar_url) ??
      readString(data.user.user_metadata?.picture),
  };
}
