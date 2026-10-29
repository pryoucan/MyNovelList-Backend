import { prisma } from "../config/db.config.js";
import { issueOtp, consumeOtp, discardOtp, isOtpFormat } from "../utils/otp-store.js";
import { normalizeEmail, serializeUser, isUniqueViolation } from "../utils/serializers.js";
import { parseImageDataUrl, uploadAvatar, deleteObject } from "../config/storage.config.js";

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

// Resend returns { error } instead of throwing, so surface it explicitly.
const sendOtpEmail = async (email, subject, code) => {
  const { error } = await resend.emails.send({
    from: "MNL Auth <onboarding@resend.dev>",
    to: email,
    subject,
    text: `Your OTP is ${code}. It expires in 10 minutes.`
  });
  if (error) {
    await discardOtp(email);
    throw new Error(`Resend failed: ${error.message}`);
  }
};

const registerUser = async (req, res) => {
  try {
    const { username, password, adminkey } = req.body;
    const email = normalizeEmail(req.body.email);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username: { equals: username, mode: "insensitive" } }
        ]
      }
    });
    if (existingUser) {
      const field = existingUser.email === email ? "Email" : "Username";
      return res.status(409).json({ message: `${field} is already taken` });
    }

    let role = "USER";

    if (adminkey) {
      if (adminkey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ message: "Invalid admin key" });
      }
      role = "ADMIN";
    }

    // The signup code isn't required to log in yet, so a failed send shouldn't block registration.
    try {
      const code = await issueOtp(email);
      await sendOtpEmail(email, "Your email verification Code", code);
    } catch (error) {
      console.log("Verification email not sent:", error.message);
    }

    const userData = await prisma.user.create({
      data: {
        username,
        email,
        password: await bcrypt.hash(password, 10),
        role
      }
    });

    return res.status(201).json({ message: "Registration successfull", userData: await serializeUser(userData) });
  }
  catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ message: "Email or username is already taken" });
    }
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};


const loginUser = async (req, res) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Admins sign in like everyone else: admin rights come from the user's
    // role in the database (checked again on every admin request), not from
    // a shared key typed into the browser. ADMIN_KEY is only used at signup.

    const token = await jwt.sign({ id: user.id, role: user.role, username: user.username },
      process.env.JWT_SECRETKEY,
      {
        expiresIn: "1d"
      }
    );

    const isLocalRequest =
      req.hostname === "localhost" ||
      req.hostname === "127.0.0.1" ||
      req.hostname === "[::1]" ||
      req.hostname.endsWith(".local") ||
      /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^169\.254\./.test(req.hostname);

    const isProduction = process.env.NODE_ENV === "production" && !isLocalRequest;

    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: "/",
    });

    res.json({
      message: "Login successful",
      role: user.role,
      username: user.username
    });

  }
  catch (error) {
    console.log(error);
    return res.status(400).json({ message: "Something went wrong" });
  }
};


const forgotPassword = async (req, res) => {
  if (!req.body.email) {
    return res.status(400).json({ message: "Email is required" });
  }
  const email = normalizeEmail(req.body.email);

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(200).json({ message: "If an account exists, a verification code has been sent." });
    }

    const code = await issueOtp(email);
    await sendOtpEmail(email, "Your verification Code", code);

    return res.status(200).json({
      message:
        `If an account exists, a verification code has been sent.`
    })
  }
  catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};


const verifyOtp = async (req, res) => {
  const { otp } = req.body;
  if (!req.body.email || !otp) {
    return res.status(400).json({ message: "Enter required fields" });
  }
  const email = normalizeEmail(req.body.email);

  try {
    const code = String(otp).trim();
    if (!isOtpFormat(code)) {
      return res.status(400).json({ message: "OTP must be 4 digits" });
    }
    if (!(await consumeOtp(email, code))) {
      return res.status(400).json({ message: "Invalid or expired otp" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = await jwt.sign(
      {
        id: user.id,
        purpose: "reset_password"
      },
      process.env.JWT_SECRETKEY,
      {
        expiresIn: "5m"
      }
    );

    return res.status(200).json({ message: "Otp verified", resetToken });
  }
  catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
}


const resetPassword = async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }
  if (password.length < 8 || password.length > 20) {
    return res.status(400).json({ message: "Password must be 8-20 characters long" });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (await bcrypt.compare(password, user.password)) {
      return res.status(400).json({
        code: "SAME_PASSWORD",
        message: "New password cannot be same as the old one"
      });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: await bcrypt.hash(password, 10) }
    });

    return res.status(200).json({ message: "Password updated successfully" });
  }
  catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
}

const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({
      message: "User profile fetched successfully",
      user: await serializeUser(user)
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const logoutUser = async (req, res) => {
  const isLocalRequest =
    req.hostname === "localhost" ||
    req.hostname === "127.0.0.1" ||
    req.hostname === "[::1]" ||
    req.hostname.endsWith(".local") ||
    /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^169\.254\./.test(req.hostname);

  const isProduction = process.env.NODE_ENV === "production" && !isLocalRequest;

  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
  return res.status(200).json({ message: "Logout successful" });
};

const updateProfile = async (req, res) => {
  try {
    const { avatar, phoneNumber } = req.body;

    const current = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!current) {
      return res.status(404).json({ message: "User not found" });
    }

    const updateData = {};
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber?.trim() || null;

    // avatar: a base64 image data URL uploads a new avatar; null/"" removes it.
    if (avatar !== undefined) {
      if (avatar) {
        const image = parseImageDataUrl(avatar);
        if (!image) {
          return res.status(400).json({ message: "Avatar must be a PNG, JPEG, or WebP image under 2MB" });
        }
        updateData.avatarKey = await uploadAvatar(current.id, image);
      } else {
        updateData.avatarKey = null;
      }
    }

    const user = await prisma.user.update({
      where: { id: current.id },
      data: updateData
    });

    if (avatar !== undefined && current.avatarKey && current.avatarKey !== user.avatarKey) {
      await deleteObject(current.avatarKey);
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      user: await serializeUser(user)
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export { registerUser, loginUser, forgotPassword, verifyOtp, resetPassword, logoutUser, getProfile, updateProfile };
