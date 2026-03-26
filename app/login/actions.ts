"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function signInAsDispatcher() {
  const cookieStore = await cookies();

  cookieStore.set("kordi_user_name", "Alex Morgan", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  cookieStore.set("kordi_user_email", "alex@kordi.app", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect("/dashboard");
}
