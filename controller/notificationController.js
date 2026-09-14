const mongoose = require("mongoose");
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

// Marks a single notification as read. Scoped to the caller so one actor can
// never flip another actor's row. Ids that are not ObjectIds (e.g. an FCM
// messageId belonging to a client-only inbox entry) are rejected up front
// rather than reaching Mongoose and throwing a CastError.
const markNotificationRead = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ status: false, message: "Invalid notification id" });
  }

  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        receiverId: req.user_id,
        receiverType: ROLE_TO_RECEIVER_TYPE[req.auth?.role] || "user",
      },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ status: false, message: "Notification not found" });
    }

    res.status(200).json({
      status: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ status: false, message: "Failed to mark notification as read" });
  }
};

// Clears the unread badge in one call — used by the "Mark all read" action.
const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      {
        receiverId: req.user_id,
        receiverType: ROLE_TO_RECEIVER_TYPE[req.auth?.role] || "user",
        read: { $ne: true },
      },
      { $set: { read: true } }
    );

    res.status(200).json({
      status: true,
      message: "Notifications marked as read",
      data: { modified: result?.modifiedCount ?? 0 },
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ status: false, message: "Failed to mark notifications as read" });
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
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotify
};
