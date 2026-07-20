const Reward = require('../models/reward');
const jwt_decode = require('jwt-decode');
const Booking = require('../models/Booking')
const Customer = require('../models/customer_model')
const { applyRewardDiscount, PricingError } = require('../services/pricingEngine')

const createReward = async (req, res) => {
    try {
        const data = jwt_decode(req.headers.token);
        const user_type = data.user_type;


        if (user_type !== 1) {
            return res.status(200).json({ status: 200, message: 'Unauthorized access!' });
        }

        const { user_id, booking_id } = req.body;


        const existingReward = await Reward.findOne({ user_id, booking_id });

        if (existingReward) {
            return res.status(200).json({ status: 200, message: 'Reward already exists for this service!' });
        }


        const reward_points = Math.floor(Math.random() * (50 - 10 + 1)) + 10;

        const reward = new Reward({
            user_id,
            booking_id,
            reward_points
        });

        await reward.save();

        return res.status(201).json({
            status: 201,
            message: 'Reward created successfully!',
            reward
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ status: 500, message: 'Something went wrong' });
    }
};

async function scratchReward(req, res) {
    const { reward_id } = req.body;
    const reward = await Reward.findById(reward_id);

    if (!reward || reward.is_scratched) {
        return res.status(400).json({ message: "Invalid or already scratched reward!" });
    }

    reward.is_scratched = true;
    await reward.save();

    // Update User's Points
    await Customer.findByIdAndUpdate(reward.user_id, {
        $inc: { reward_points: reward.reward_points }
    });

    return res.status(200).json({
        message: "Scratch successful!",
        reward_points: reward.reward_points
    });
}


const getUserRewards = async (req, res) => {
    try {
        const data = jwt_decode(req.headers.token);
        const user_id = data.user_id;

        if (!user_id) {
            return res.status(200).json({ status: 200, message: 'User is unauthorized!' });
        }

        const rewards = await Reward.find({ user_id, is_scratched: false });

        return res.status(200).json({
            status: 200,
            rewards
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ status: 500, message: 'Something went wrong' });
    }
};

async function applyRewardPoints(req, res) {
    const { user_id, booking_id, points_to_use } = req.body;
    const user = await Customer.findById(user_id);
    const booking = await Booking.findById(booking_id);

    if (!user || !booking) {
        return res.status(200).json({ message: "Invalid user or booking!" });
    }

    if (user.reward_points < points_to_use) {
        return res.status(200).json({ message: "Not enough points!" });
    }

    // Reward redemption is a discount, never a rewrite of the immutable
    // pricing snapshot: subtotal/serviceAmount/commission/dealerEarnings never
    // move. Only discountAmount increases; amountDue (a virtual on Booking) =
    // customerTotal - discountAmount reflects the reduction automatically.
    // See services/pricingEngine.js#applyRewardDiscount().
    try {
        applyRewardDiscount(booking, points_to_use);
    } catch (err) {
        if (err instanceof PricingError) {
            return res.status(400).json({ message: err.message, code: err.code });
        }
        throw err;
    }
    await booking.save();

    // Deduct points from user
    user.reward_points -= points_to_use;
    await user.save();

    return res.status(200).json({
        message: "Points applied!",
        discountAmount: booking.discountAmount,
        amountDue: booking.amountDue,
    });
}


async function handleBookingCompletion(booking) {
    console.log("Booking Data:", booking); // Debugging log

    if (!booking || !booking.user_id || !booking._id) {
        console.error("❌ Missing user_id or booking_id");
        return;
    }

    const reward_points = Math.floor(Math.random() * (50 - 10 + 1)) + 10; // Random 10-50 points

    const reward = new Reward({
        user_id: booking.user_id.toString(),  // Convert ObjectId to string
        booking_id: booking._id.toString(),  // Convert ObjectId to string
        reward_points
    });

    await reward.save();

    await Customer.findByIdAndUpdate(booking.user_id, {
        $inc: { reward_points: reward_points }
    });

    console.log("✅ Reward Created Successfully:", reward);
}

const getRewardPoints = async (req, res) => {
    try {
        const token = req.headers.token;

        if (!token) {
            return res.status(401).json({
                status: false,
                message: 'Token is required',
                data: null
            });
        }

        const data = jwt_decode(token);
        const user_id = data.user_id;

        if (!user_id) {
            return res.status(400).json({
                status: false,
                message: 'Invalid token. user_id not found.',
                data: null
            });
        }

        const customer = await Customer.findOne({ where: { id: user_id } });

        if (!customer) {
            return res.status(404).json({
                status: false,
                message: 'Customer not found',
                data: null
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Reward points fetched successfully',
            data: { reward_points: customer.reward_points }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            message: 'Internal Server Error',
            data: null
        });
    }
};

// By Prashant 
const getRewards = async (req, res) => {
    try {
        const rewards = await Reward.find()
            .populate("user_id")
            .populate({
                path: "booking_id",
                populate: {
                    path: "services",
                },
            });

        return res.status(200).json({
            status: true,
            rewards,
        });
    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({
            status: false,
            message: "Something went wrong",
        });
    }
};


module.exports = {
    createReward,
    getUserRewards,
    scratchReward,
    handleBookingCompletion,
    applyRewardPoints,
    getRewards,
    getRewardPoints
};
