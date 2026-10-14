import bcrypt from "bcryptjs";

const cost = () => Number(process.env.BCRYPT_COST ?? 12);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, cost());
}

// Compared against when the email does not exist, so response timing doesn't reveal registered emails.
let dummyHash: string | null = null;

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  dummyHash ??= await bcrypt.hash("veltrix-timing-equalizer", cost());
  const ok = await bcrypt.compare(password, hash ?? dummyHash);
  return hash !== null && ok;
}
