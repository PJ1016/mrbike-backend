const express = require('express');
const { suadminLogin, AdminPermission, updateAdminPermission, suadminsignup, getAllAdmin, deleteAdmin, subadminsignup, updateProfilePicture, getProfilePicture, changePassword, singleadmin, getSingleRole, sendOtp, verifyOtp, dashboardCounts, updateStatus } = require('../controller/adminAuth');
const router = express.Router();
const multer = require('multer');
const { requireAdmin } = require('../middlewares/requireAdmin');
const admin = require('../models/admin_model');
var bcrypt = require('bcryptjs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './image');
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    },
});

const upload = multer({ storage: storage });

/* POST users listing. */
router.post('/register-admin', requireAdmin, async (req, res) => {
    try {
        const { name, email, password, mobile, role, image } = req.body;

        // Validate required fields
        if (!name || !email || !password || !mobile || !role) {
            return res.status(400).json({ message: "All required fields must be provided." });
        }

        // Check if email already exists
        const existing = await admin.findOne({ email });
        if (existing) {
            return res.status(409).json({ message: "Email already registered." });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new admin
        const newAdmin = new admin({
            name,
            email,
            password: hashedPassword,
            mobile,
            role,
            image,
        });

        await newAdmin.save();

        res.status(201).json({
            message: "Admin registered successfully.",
            data: {
                _id: newAdmin._id,
                name: newAdmin.name,
                email: newAdmin.email,
                role: newAdmin.role,
                mobile: newAdmin.mobile,
                employeeId: newAdmin.employeeId,
                status: newAdmin.status,
            },
        });

    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ message: "Server error during registration." });
    }
});

router.post('/suadminLogin', suadminLogin);
router.put("/admin/:id", requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, mobile, password } = req.body;

        // Basic validation
        if (!name || !email || !role || !mobile) {
            return res.status(400).json({ message: "Name, email, role, and mobile are required." });
        }

        // Validate role
        const validRoles = ["Telecaller", "Manager", "Admin", "Subadmin", "Executive"];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ message: "Invalid role." });
        }

        // Find admin by ID and include password for update if needed
        const Admin = await admin.findById(id).select("+password");
        if (!Admin) {
            return res.status(404).json({ message: "Admin not found." });
        }

        // Update fields
        Admin.name = name;
        Admin.email = email;
        Admin.role = role;
        Admin.mobile = mobile;

        if (password) {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            Admin.password = hashedPassword;
        }

        await Admin.save();

        // Remove password from response
        const AdminObj = Admin.toObject();
        delete AdminObj.password;

        return res.json({ message: "Admin updated successfully", Admin: AdminObj });
    } catch (error) {
        console.error(error);
        if (error.code === 11000) {
            // Duplicate email or employeeId error
            return res.status(400).json({ message: "Email or Employee ID already exists." });
        }
        return res.status(500).json({ message: "Server error." });
    }
});
router.post('/subadminsignup', requireAdmin, subadminsignup);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.get('/getalladmin', requireAdmin, getAllAdmin);
router.post('/update-status/:id', requireAdmin, updateStatus);
router.delete('/deleteadmin/:admin_id', requireAdmin, deleteAdmin);
router.get('/dashboard-counts', requireAdmin, dashboardCounts);


router.post('/Changepassword/:id', requireAdmin, changePassword);
router.post('/profile', requireAdmin, upload.single('images'), updateProfilePicture);
router.get('/profile', requireAdmin, getProfilePicture);
router.get('/singleAdmin/:id', requireAdmin, singleadmin);
router.post('/AdminPermission/:id', requireAdmin, AdminPermission);
router.post('/updatePermission/:id', requireAdmin, updateAdminPermission);
router.get('/SinglePermission/:id', requireAdmin, getSingleRole);

module.exports = router;
