import { headers } from "next/headers";

import { auth } from "@/lib/auth";

/** The signed-in session for this request, or null. Reads the database at most once per 5 minutes per browser (cookie cache). */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
