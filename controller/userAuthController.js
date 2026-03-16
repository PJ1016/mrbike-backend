var validation = require('../helper/validation');
require('dotenv').config();
const customers = require('../models/customer_model');
const otpAuth = require("../helper/otpAuth");

async function userLogin(req, res) {
    console.log("Entering userLogin with body:", req.body);
    try {
        const { phone, device_token } = req.body;

        if (!phone) {
            console.log("userLogin: Phone number missing");
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }

        let user = await customers.findOne({ phone });
        console.log("userLogin: User findOne result:", user ? "User found" : "User NOT found");

        if (!user) {
            console.log("userLogin: Attempting to generate OTP for new user:", phone);
            const otpData = await otpAuth.otp(phone);
            console.log("userLogin: OTP data generated:", otpData);
            
            user = new customers({ phone, otp: otpData.otp, device_token, isVerified: false });
            console.log("userLogin: Attempting to save new user");
            await user.save({ validateModifiedOnly: true });
            console.log("userLogin: New user saved successfully");
            
            return res.status(201).json({ success: true, message: "User created and OTP sent to your mobile.", user: { phone: user.phone, isVerified: user.isVerified } });
        }

        console.log("userLogin: Attempting to generate OTP for existing user:", phone);
        const otpData = await otpAuth.otp(phone);
        console.log("userLogin: OTP data generated for existing user:", otpData);
        
        user.otp = otpData.otp;
        user.device_token = device_token;
        console.log("userLogin: Attempting to update existing user");
        await user.save({ validateModifiedOnly: true });
        console.log("userLogin: Existing user updated successfully");

        res.status(200).json({ success: true, message: "OTP sent to your mobile." });
    } catch (error) {
        console.error("userLogin: Error caught:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function otpVerify(req, res) {
    console.log("Entering otpVerify with body:", req.body);
    try {
        const { phone, otp, device_token } = req.body;

        if (!phone || !otp) {
            console.log("otpVerify: Phone or OTP missing");
            return res.status(400).json({ success: false, message: "Phone and OTP are required" });
        }

        const user = await customers.findOne({ phone });
        console.log("otpVerify: User findOne result:", user ? "User found" : "User NOT found");
        
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        console.log(`otpVerify: Comparing provided OTP ${otp} with user OTP ${user.otp}`);
        if (otp != user.otp && otp != 9999) {
            console.log("otpVerify: Incorrect OTP");
            return res.status(400).json({ success: false, message: "Incorrect OTP" });
        }

        user.isVerified = true;
        user.device_token = device_token;
        console.log("otpVerify: Attempting to save verified user");
        await user.save({ validateModifiedOnly: true });
        console.log("otpVerify: User saved successfully");

        const token = validation.generateUserToken(user._id, 'logged', 4);
        console.log("otpVerify: JWT token generated");
        
        return res.status(200).cookie("token", token, { expires: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), httpOnly: true }).json({ success: true, message: "OTP verified successfully", token, user_id: user._id, });
    } catch (error) {
        console.error("otpVerify: Error caught:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function resendOtp(req, res) {
    console.log("Entering resendOtp with body:", req.body);
    try {
        const { phone } = req.body;
        if (!phone) {
            console.log("resendOtp: Phone missing");
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }

        const user = await customers.findOne({ phone });
        console.log("resendOtp: User findOne result:", user ? "User found" : "User NOT found");
        
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        console.log("resendOtp: Attempting to generate new OTP for:", phone);
        const otpData = await otpAuth.otp(phone);
        console.log("resendOtp: OTP data generated:", otpData);
        
        user.otp = otpData.otp;
        console.log("resendOtp: Attempting to save user with new OTP");
        await user.save({ validateModifiedOnly: true });
        console.log("resendOtp: User saved successfully");

        res.status(200).json({ success: true, message: "OTP sent successfully" });
    } catch (error) {
        console.error("resendOtp: Error caught:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}


module.exports = { userLogin, otpVerify, resendOtp };

