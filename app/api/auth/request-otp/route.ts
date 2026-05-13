import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ALLOWED_EMAILS } from "@/server/auth/allowed-emails";
import { createAndSendOtp } from "@/server/auth/otp";

const schema = z.object({
  email: z.string().email().toLowerCase(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
  }

  const { email } = parsed.data;

  if (ALLOWED_EMAILS.has(email)) {
    try {
      await createAndSendOtp(email);
    } catch (err) {
      console.error("[request-otp] failed to send:", err);
      return NextResponse.json({ error: "Erro ao enviar código" }, { status: 500 });
    }
  }

  // Always return 200 regardless of whether email is allowed (security)
  return NextResponse.json({ ok: true });
}
