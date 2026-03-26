import { cookies } from "next/headers";

export type AuthUser = {
  name: string;
  email?: string;
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const name = cookieStore.get("kordi_user_name")?.value;

  if (!name) {
    return null;
  }

  return {
    name,
    email: cookieStore.get("kordi_user_email")?.value,
  };
}
