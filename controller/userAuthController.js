const path = require('path');
var validation = require('../helper/validation');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const customers = require('../models/customer_model');
const twilio = require('twilio');
const { generateUniqueReferralCode } = require('../utils/referralCodeGenerator');
const { isCustomerTestPhone, isCustomerTestOtpValid } = require('../helper/playStoreTestAccounts');

function getTwilioClient() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    const verifySid  = process.env.TWILIO_VERIFY_SERVICE_SID;
    console.log("[Twilio] ACCOUNT_SID :", accountSid  || "MISSING");
    console.log("[Twilio] VERIFY_SID  :", verifySid   || "MISSING");
    console.log("[Twilio] AUTH_TOKEN  :", authToken ? authToken.slice(0, 8) + "..." : "MISSING");
    if (!verifySid) throw new Error("[Twilio] TWILIO_VERIFY_SERVICE_SID is undefined — check .env on server");
    if (!accountSid) throw new Error("[Twilio] TWILIO_ACCOUNT_SID is undefined — check .env on server");
    return twilio(accountSid, authToken);
}

async function userLogin(req, res) {
    try {
        const { phone, ftoken, device_token } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }

        let user = await customers.findOne({ phone });

        if (!user) {
            const referralCode = await generateUniqueReferralCode(customers);
            user = new customers({ phone, ftoken, device_token, isVerified: false, referralCode });
            if (isCustomerTestPhone(phone)) user.isPlayStoreTestAccount = true;
            await user.save({ validateModifiedOnly: true });
        } else {
            user.device_token = device_token || user.device_token;
            user.ftoken = ftoken || user.ftoken;
            await user.save({ validateModifiedOnly: true });
        }

        // Google Play Review Test Account
        // Do not remove without replacing the Play Store testing process.
        // Fixed reviewer number: never hits Twilio, no OTP is actually sent —
        // the app-side verify step accepts only the hardcoded OTP for this number.
        if (isCustomerTestPhone(phone)) {
            const isNew = !user.isVerified;
            return res.status(isNew ? 201 : 200).json({
                success: true,
                message: "OTP sent to your mobile.",
                user: { phone: user.phone, isVerified: user.isVerified },
            });
        }

        const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;
        console.log("[userAuth/userLogin] ACCOUNT_SID:", process.env.TWILIO_ACCOUNT_SID);
        console.log("[userAuth/userLogin] VERIFY_SID:", verifySid);

        const phoneNumber = phone.trim().startsWith("+") ? phone.trim() : `+91${phone.trim()}`;
        console.log("Twilio TO:", phoneNumber);

        const twilioClient = getTwilioClient();
        const sendResult = await twilioClient.verify.v2
            .services(verifySid)
            .verifications
            .create({ to: phoneNumber, channel: 'sms' });

        console.log("[userAuth/userLogin] Twilio send status:", sendResult.status, "| SID:", sendResult.sid);

        const isNew = !user.isVerified;
        return res.status(isNew ? 201 : 200).json({
            success: true,
            message: "OTP sent to your mobile.",
            user: { phone: user.phone, isVerified: user.isVerified },
        });
    } catch (error) {
        console.error("userLogin error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function otpVerify(req, res) {
    try {
        const { phone, otp, ftoken, device_token } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({ success: false, message: "Phone and OTP are required" });
        }

        // Google Play Review Test Account
        // Do not remove without replacing the Play Store testing process.
        // Fixed reviewer number: bypasses Twilio entirely and only ever
        // succeeds for the exact hardcoded OTP below. The account is
        // auto-created with minimum fields if it doesn't already exist so
        // reviewers never depend on prior app state. No SMS is sent and no
        // Twilio quota is consumed for this number.
        if (isCustomerTestPhone(phone)) {
            if (!isCustomerTestOtpValid(phone, otp)) {
                return res.status(400).json({ success: false, message: "Incorrect OTP" });
            }

            let user = await customers.findOne({ phone });
            if (!user) {
                user = new customers({ phone, isVerified: true, isPlayStoreTestAccount: true });
            }
            user.isVerified = true;
            user.isPlayStoreTestAccount = true;
            if (device_token) user.device_token = device_token;
            if (ftoken) user.ftoken = ftoken;
            await user.save({ validateModifiedOnly: true });

            const hasProfile = user.isProfile || (user.first_name && user.first_name.trim().length > 0);
            const token = validation.generateUserToken(user._id, 'logged', 4);
            return res.status(200)
                .cookie("token", token, { expires: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), httpOnly: true })
                .json({ success: true, message: "OTP verified successfully", token, user_id: user._id, isProfile: hasProfile });
        }

        const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;
        console.log("[userAuth/otpVerify] ACCOUNT_SID:", process.env.TWILIO_ACCOUNT_SID);
        console.log("[userAuth/otpVerify] VERIFY_SID:", verifySid);

        const phoneNumber = phone.trim().startsWith("+") ? phone.trim() : `+91${phone.trim()}`;
        console.log("Twilio TO:", phoneNumber);

        const twilioClient = getTwilioClient();
        const verificationCheck = await twilioClient.verify.v2
            .services(verifySid)
            .verificationChecks
            .create({ to: phoneNumber, code: otp });

        console.log("[userAuth/otpVerify] Twilio check status:", verificationCheck.status);

        if (verificationCheck.status !== 'approved') {
            return res.status(400).json({ success: false, message: "Incorrect OTP" });
        }

        const user = await customers.findOne({ phone });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        user.isVerified = true;
        if (device_token) user.device_token = device_token;
        if (ftoken) user.ftoken = ftoken;
        await user.save({ validateModifiedOnly: true });

        const hasProfile = user.isProfile || (user.first_name && user.first_name.trim().length > 0);

        const token = validation.generateUserToken(user._id, 'logged', 4);
        return res.status(200)
            .cookie("token", token, { expires: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), httpOnly: true })
            .json({ success: true, message: "OTP verified successfully", token, user_id: user._id, isProfile: hasProfile });
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

        // Google Play Review Test Account
        // Do not remove without replacing the Play Store testing process.
        // Fixed reviewer number: OTP is a hardcoded constant, so there is
        // nothing to resend and Twilio must never be hit for this number.
        if (isCustomerTestPhone(phone)) {
            return res.status(200).json({ success: true, message: "OTP sent successfully" });
        }

        const phoneNumber = phone.trim().startsWith("+") ? phone.trim() : `+91${phone.trim()}`;
        console.log("Twilio TO:", phoneNumber);

        const twilioClient = getTwilioClient();
        await twilioClient.verify.v2
            .services(process.env.TWILIO_VERIFY_SERVICE_SID)
            .verifications
            .create({ to: phoneNumber, channel: 'sms' });

        res.status(200).json({ success: true, message: "OTP sent successfully" });
    } catch (error) {
        console.error("resendOtp error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}


module.exports = { userLogin, otpVerify, resendOtp };
