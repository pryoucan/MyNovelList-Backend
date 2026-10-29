import bcrypt from "bcryptjs";
import { prisma } from "../config/db.config.js";
import { randomInt } from "node:crypto";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const OTP_LENGTH = 4;

export const isOtpFormat = (code) => new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code);

// Cryptographically random, zero-padded: "0000"-"9999".
const generateCode = () => String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");

// Creates (or replaces) the pending code for an email and returns the plain code.
export const issueOtp = async (email) => {
  const code = generateCode();
  const data = {
    codeHash: await bcrypt.hash(code, 10),
    attempts: 0,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  };
  await prisma.otp.upsert({
    where: { email },
    create: { email, ...data },
    update: data,
  });
  return code;
};

export const discardOtp = (email) => prisma.otp.deleteMany({ where: { email } });

// True if the code matches an unexpired OTP; the OTP is consumed on success.
// After MAX_ATTEMPTS wrong guesses the OTP is discarded.
export const consumeOtp = async (email, code) => {
  const otp = await prisma.otp.findUnique({ where: { email } });
  if (!otp) return false;

  if (otp.expiresAt <= new Date() || otp.attempts >= MAX_ATTEMPTS) {
    await discardOtp(email);
    return false;
  }

  if (!(await bcrypt.compare(code, otp.codeHash))) {
    await prisma.otp.update({ where: { email }, data: { attempts: { increment: 1 } } });
    return false;
  }

  await discardOtp(email);
  return true;
};

export const purgeExpiredOtps = async () => {
  const { count } = await prisma.otp.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return count;
};
