import crypto from "crypto";
import bcrypt from "bcryptjs";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/server/db/client";
import { emailOtps } from "@/server/db/schema";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Murano Dashboard <no-reply@interno.muranojoias.com.br>";
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateCode(): string {
  return crypto.randomInt(100_000, 1_000_000).toString();
}

export async function createAndSendOtp(email: string): Promise<void> {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.insert(emailOtps).values({ email, codeHash, expiresAt });

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Seu código de acesso — Murano Dashboard",
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px 24px">
        <p style="font-size:14px;color:#555;margin-bottom:8px">Dashboard de Gestão · Murano Joias</p>
        <h2 style="font-size:32px;letter-spacing:6px;font-weight:700;color:#111;margin:16px 0">${code}</h2>
        <p style="font-size:13px;color:#888">Válido por 10 minutos. Não compartilhe este código.</p>
      </div>
    `,
  });
}

export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const now = new Date();
  const rows = await db
    .select()
    .from(emailOtps)
    .where(
      and(
        eq(emailOtps.email, email),
        gt(emailOtps.expiresAt, now),
        isNull(emailOtps.usedAt),
      ),
    )
    .orderBy(desc(emailOtps.createdAt))
    .limit(5);

  for (const row of rows) {
    const ok = await bcrypt.compare(code, row.codeHash);
    if (ok) {
      await db
        .update(emailOtps)
        .set({ usedAt: now })
        .where(eq(emailOtps.id, row.id));
      return true;
    }
  }
  return false;
}
