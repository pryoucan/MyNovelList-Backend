import { purgeExpiredOtps } from "../utils/otp-store.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const runCleanup = async () => {
  try {
    const count = await purgeExpiredOtps();
    console.log(`OTP cleanup: removed ${count} expired code(s)`);
  } catch (error) {
    console.log("OTP cleanup failed:", error);
  }
};

// Runs once at startup, then daily. Expiry is also enforced on verify,
// so this only keeps the table tidy.
export const startOtpCleanup = () => {
  runCleanup();
  setInterval(runCleanup, ONE_DAY_MS).unref();
};
