import User from '../models/User.js';
import crypto from "crypto";
import generateToken from '../utils/generateToken.js';
import sendEmail from '../utils/sendEmail.js';
import sendToken from '../utils/sendToken.js';
// import twilio from("twilio");
import {
  canRegisterAsSeller,
  syncUserRoleWithWhitelist,
} from '../utils/sellerAccess.js';

const formatUserResponse = (user, token) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  token,
});

export const authUser = async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const { password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }

  let user = await User.findOne({ email, accountVerified: true });

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  user = await syncUserRoleWithWhitelist(user);
  const token = generateToken(res, user._id);

  res.json(formatUserResponse(user, token));
};

export const registerUser = async (req, res) => {
  
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const { password } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Name, email, and password are required');
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    // Create user but mark accountVerified as false
    const user = await User.create({
      name,
      email,
      password,
      role: 'customer',
      accountVerified: false,
    });

    // Generate OTP
    const verificationCode = await user.generateVerificationCode();
    await user.save();

    // Send OTP via email
    const message = generateEmailTemplate(verificationCode);
    await sendEmail({ email, subject: 'Your Verification Code', message });

    res.status(200).json({
      success: true,
      message: `Verification code sent to ${email}. Please verify to complete registration.`,
      userId: user._id, // frontend will use this for OTP verification
    });
  
};

async function sendVerificationCode(
  verificationMethod,
  verificationCode,
  name,
  email,
  phone,
  res
) {
  try {
    if (verificationMethod === "email") {
      const message = generateEmailTemplate(verificationCode);
      sendEmail({ email, subject: "Your Verification Code", message });
      res.status(200).json({
        success: true,
        message: `Verification email successfully sent to ${name}`,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Invalid verification method.",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Verification code failed to send.",
    });
  }
}

function generateEmailTemplate(verificationCode) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
      <h2 style="color: #4CAF50; text-align: center;">Verification Code</h2>
      <p style="font-size: 16px; color: #333;">Dear User,</p>
      <p style="font-size: 16px; color: #333;">Your verification code is:</p>
      <div style="text-align: center; margin: 20px 0;">
        <span style="display: inline-block; font-size: 24px; font-weight: bold; color: #4CAF50; padding: 10px 20px; border: 1px solid #4CAF50; border-radius: 5px; background-color: #e8f5e9;">
          ${verificationCode}
        </span>
      </div>
      <p style="font-size: 16px; color: #333;">Please use this code to verify your email address. The code will expire in 10 minutes.</p>
      <p style="font-size: 16px; color: #333;">If you did not request this, please ignore this email.</p>
      <footer style="margin-top: 20px; text-align: center; font-size: 14px; color: #999;">
        <p>Thank you,<br>User</p>
        <p style="font-size: 12px; color: #aaa;">This is an automated message. Please do not reply to this email.</p>
      </footer>
    </div>
  `;
}


export const verifyOTPController = async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email, accountVerified: false });
  if (!user) { throw new Error("User not found.", 404)};

  if (user.verificationCode !== Number(otp)) {
     throw new Error("Invalid OTP.", 400);
  }

  if (Date.now() > new Date(user.verificationCodeExpire).getTime()) {
     throw new Error("OTP Expired.", 400);
  }

  user.accountVerified = true;
  user.verificationCode = null;
  user.verificationCodeExpire = null;
  await user.save();

  // Generate token after verification
  const token = generateToken(res, user._id);

  res.status(200).json({
    success: true,
    message: "Account verified successfully.",
    token,
    user,
  });
};




export const logoutUser = (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.status(200).json({ message: 'Logged out successfully' });
};

export const getUserProfile = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const syncedUser = await syncUserRoleWithWhitelist(user);
  res.json(formatUserResponse(syncedUser));
};


export const forgotPasswordController = async (req, res) => {
  const user = await User.findOne({
    email: req.body.email,
    accountVerified: true,
  });

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  const resetToken = user.generateResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  const resetPasswordUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`;
  const message = `Your Reset Password Token is:- \n\n ${resetPasswordUrl} \n\n If you have not requested this email then please ignore it.`;

  try {
    await sendEmail({
      email: user.email,
      subject: "RESET Your PASSWORD",
      message,
    });

    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully.`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(500).json({
      success: false,
      message: error.message || "Cannot send reset password token.",
    });
  }
};

// reset password
export const resetPasswordController = async (req, res) => {
  const { token } = req.params;
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: "Reset password token is invalid or has expired.",
    });
  }

  if (req.body.password !== req.body.confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Password & confirm password do not match.",
    });
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendToken(user, 200, "Reset Password Successfully.", res);
};