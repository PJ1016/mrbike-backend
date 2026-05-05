const BannerV2 = require("../models/BannerV2");

// Get All Active Banners
exports.getBanners = async (req, res) => {
  try {
    const banners = await BannerV2.find({ isActive: true }).sort({ createdAt: -1 });

    const formattedBanners = banners.map((b) => ({
      id: b.bannerId,
      image: b.image,
      action: b.action,
      target: b.target,
      title: b.title,
      subtitle: b.subtitle,
    }));

    res.status(200).json({
      status: true,
      banners: formattedBanners,
    });
  } catch (error) {
    console.error("Get Banners Error:", error);
    res.status(500).json({
      status: false,
      message: "Server Error",
    });
  }
};
