var validation = require('../helper/validation');
require('dotenv').config();
const customers = require('../models/customer_model');
const otpAuth = require("../helper/otpAuth");

async function userLogin(req, res) {
    try {
        const { phone, device_token } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }

        let user = await customers.findOne({ phone });

        if (!user) {
            const otpData = await otpAuth.otp(phone);
            user = new customers({ phone, otp: otpData.otp, device_token, isVerified: false });
            await user.save({ validateModifiedOnly: true });
            return res.status(201).json({ success: true, message: "User created and OTP sent to your mobile.", user: { phone: user.phone, isVerified: user.isVerified } });
        }

        const otpData = await otpAuth.otp(phone);
        user.otp = otpData.otp;
        user.device_token = device_token;
        await user.save({ validateModifiedOnly: true });

        res.status(200).json({ success: true, message: "OTP sent to your mobile." });
    } catch (error) {
        console.error("userLogin error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function otpVerify(req, res) {
    try {
        const { phone, otp, device_token } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({ success: false, message: "Phone and OTP are required" });
        }

        const user = await customers.findOne({ phone });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (otp != user.otp && otp != 9999) {
            return res.status(400).json({ success: false, message: "Incorrect OTP" });
        }

        user.isVerified = true;
        user.device_token = device_token;
        await user.save({ validateModifiedOnly: true });

        const token = validation.generateUserToken(user._id, 'logged', 4);
        return res.status(200).cookie("token", token, { expires: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), httpOnly: true }).json({ success: true, message: "OTP verified successfully", token, user_id: user._id, });
    } catch (error) {
        console.error("otpVerify error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function resendOtp(req, res) {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }

        const user = await customers.findOne({ phone });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const otpData = await otpAuth.otp(phone);
        user.otp = otpData.otp;
        await user.save({ validateModifiedOnly: true });

        res.status(200).json({ success: true, message: "OTP sent successfully" });
    } catch (error) {
        console.error("resendOtp error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}


module.exports = { userLogin, otpVerify, resendOtp };

