const Notification = require("../models/Notification");

// req.auth.role comes from authenticateActor ("customer"/"dealer"/"admin"),
// while Notification.receiverType (and how pushNotification.js writes
// notifications) uses "user"/"dealer"/"admin" — map between the two.
const ROLE_TO_RECEIVER_TYPE = { customer: "user", dealer: "dealer", admin: "admin" };

const getNotificationsByReceiverId = async (req, res) => {
  const { receiverId } = req.params;

  try {
    const notifications = await Notification.find({
        receiverId: req.user_id,
        receiverType: ROLE_TO_RECEIVER_TYPE[req.auth?.role] || "user",
      }).sort({ createdAt: -1 });

    res.status(200).json({
      status: true,
      message: "Notifications fetched successfully",
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      status: false,
      message: "Failed to fetch notifications",
    });
  }
};

const deleteNotify = async (req,res) =>{
    try{
        let {id} = req.params
        const notify = await Notification.findOneAndDelete({_id:id, receiverId: req.user_id, receiverType: ROLE_TO_RECEIVER_TYPE[req.auth?.role] || "user"})
        if(notify){
            res.status(200).json({
                status: true,
                message: "Notifications deleted successfully",
               
              });
        }else{
            res.status(200).json({
                status: true,
                message: "notification not found",
               
              });
        }
    }catch(err){
      console.log(err)
    }
    
}

module.exports = {
  getNotificationsByReceiverId,
  deleteNotify
};
