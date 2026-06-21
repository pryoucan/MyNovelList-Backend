import { User } from "../models/user.model.js";
import { redis } from "../config/redis.config.js";
import { otpGenerator } from "../utils/otp-generator.js";

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

const registerUser = async (req, res) => {
  try {
    const { username, email, password, adminkey } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const saveOtp = otpGenerator(6, 35);
    const otpToStore = await bcrypt.hash(saveOtp, 10);
    const key = `otp:${email}`;

    await redis.set(key, otpToStore, { ex: 600 });

    await resend.emails.send({
      from: "MNL Auth <onboarding@resend.dev>",
      to: email,
      subject: "Your email verification Code",
      text: `Your OTP is ${saveOtp}. It expires in 10 minutes.`
    });

    

    let role = "USER";

    if (adminkey) {
      if (adminkey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ message: "Invalid admin key" });
      }
      role = "ADMIN";
    }

    const userData = await User.create({
      username,
      email,
      password,
      role
    });

    return res.status(201).json({ message: "Registration successfull", userData });
  }
  catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};


const loginUser = async (req, res) => {
  try {
    const { email, password, adminkey } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }


    if (user.role === "ADMIN") {
      if (!adminkey || adminkey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ message: "Admin verification failed" });
      }
    }

    const token = await jwt.sign({ id: user._id, role: user.role, username: user.username },
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
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ message: "If an account exists, a verification code has been sent." });
    }

    const saveOtp = otpGenerator(6, 35);
    const otpToStore = await bcrypt.hash(saveOtp, 10);
    const key = `otp:${email}`;
    await redis.set(key, otpToStore, { ex: 600 });

    await resend.emails.send({
      from: "MNL Auth <onboarding@resend.dev>",
      to: email,
      subject: "Your verification Code",
      text: `Your OTP is ${saveOtp}. It expires in 10 minutes.`
    });

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
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: "Enter required fields" });
  }

  try {
    const key = `otp:${email}`
    const dbOtp = await redis.get(key);
    if (!dbOtp) {
      return res.status(400).json({ message: "Invalid or expired otp" })
    }
    if (!(await bcrypt.compare(otp, dbOtp))) {
      return res.status(400).json({ message: "Invalid or expired otp" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = await jwt.sign(
      {
        id: user._id,
        purpose: "reset_password"
      },
      process.env.JWT_SECRETKEY,
      {
        expiresIn: "5m"
      }
    );

    await redis.del(key);

    return res.status(200).json({ message: "Otp verified", resetToken });
  }
  catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
}


const resetPassword = async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }
  try {
    const user = await User.findById({ _id: req.user.id });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (await user.matchPassword(password)) {
      return res.status(400).json({
        message: "New password cannot be same as the old one"
      });
    }

    const newPassword = await bcrypt.hash(password, 10);

    await User.findOneAndUpdate(
      {
        _id: req.user.id
      },
      {
        password: newPassword
      },
      {
        new: true
      }
    );

    return res.status(200).json({ message: "Password updated successfully" });
  }
  catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
}

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({
      message: "User profile fetched successfully",
      user
    });
  } catch (error) {
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
    
    const updateData = {};
    if (avatar !== undefined) updateData.avatar = avatar;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      user
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export { registerUser, loginUser, forgotPassword, verifyOtp, resetPassword, logoutUser, getProfile, updateProfile };