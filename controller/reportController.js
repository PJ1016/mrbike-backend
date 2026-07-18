const user = require('../models/customer_model');
const Vendor = require('../models/dealerModel');
const Report = require('../models/report_Model')
const booking = require('../models/Booking');
const jwt_decode = require('jwt-decode');
const mongoose = require('mongoose')
const Role = require('../models/Roles_modal')
const Admin = require('../models/admin_model')

async function checkPermission(user_id, requiredPermission) {
  try {
      const userRole = await Role.findOne({ subAdmin: user_id });
      console.log(userRole,"1")
      if (!userRole) {
          return false;
      }
      const permissions = userRole.permissions;
      console.log(permissions,"2")

      const [module, permission] = requiredPermission.split('.');
    
      // Check if the module and permission exist in permissions object
      if (!permissions || !permissions[module] || !permissions[module][permission]) {
        return false;
      }
      return true;
  } catch (error) {
      console.error("Error while checking permission:", error);
      return false;
  }
}

const ReportAdd = async (req, res) => {
  const data = jwt_decode(req.headers.token);
  const user_id = data.user_id;

  const { dealer_id, booking_id, message, Reply, ReplyType, status } = req.body;
   console.log(req.body)
  if (!dealer_id) {
    return res.status(404).send({ status: false, message: 'Dealer ID is required' });
  }

  try {
    const dealerFind = await Vendor.findOne({ _id: mongoose.Types.ObjectId(dealer_id) });
    if (!dealerFind) {
      return res.status(404).send({ status: false, message: 'Dealer not found' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send({ status: false, message: 'Internal Server Error' });
  }

 
  if (!message) {
    return res.status(400).send({ status: false, message: 'Please describe your problem' });
  }

  try {
    
      const data = {
        user_id:user_id,
        dealer_id,
        booking_id,
        message,
        Reply,
        ReplyType,
        status
      }
 const reportdata = await Report.create(data)

      res.status(200).send({ status: true, message: 'Report added successfully',data:reportdata });

    
  } catch (error) {
    console.error(error);
    return res.status(500).send({ status: false, message: 'Internal Server Error' });
  }

  };
const SingleReport = async (req, res) => {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    const type = data.type;
  
    if (user_id == null || (user_type !== 1 && user_type !== 2 && user_type !== 4)) {
      var response = {
        status: 401,
        message: "admin is unauthorized!",
      };
      return res.status(401).send(response);
    }
  
    try {
      const report = await Report.findById(req.params.id);
    console.log(report)
      if (report) {
        res.status(200).send({ status: true, data: report });
      } else {
        res.status(404).send({ status: false, message: 'Report not found' });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).send({ status: false, message: "Internal Server Error" });
    }
}; 
const AllReport = async(req,res)=>{
  try{
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    const type = data.type;
    if (user_id == null || user_type != 1 && user_type != 2 && user_type != 3) {
      var response = {
        status: 401,
        message: "admin is un-authorised !",
      };
      return res.status(401).send(response);
    }
 
    const report =  await Report.find(req.query).populate({path:"user_id",select:['first_name','id']})
    .populate({path:"dealer_id",select:['name','id']})
    .populate({path:"booking_id",select:["id"]})
    .sort({ "_id": -1 });

    return res.status(200).send({status:true,message:'all report',data:report})

  }catch (error) {
    console.error(error);
    return res.status(500).send({ status: false, message: 'Internal Server Error' });
  }


}

const replyAdmin = async (req, res) => {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    const type = data.type;
    if (user_id == null || user_type != 1) {
     
        if(user_type === 3){
        const subAdmin = await Admin.findById(user_id)
        
        if (!subAdmin) {
          var response = {
            status: 401,
            message: "Subadmin not found!",
          };
          return res.status(401).send(response);
        }
  
        if(user_type === 3){
          const subAdmin = await Admin.findById(user_id)
          
          if (!subAdmin) {
            var response = {
              status: 401,
              message: "Subadmin not found!",
            };
            return res.status(401).send(response);
          }
        }
    
        const isAllowed = await checkPermission(user_id, "Reports.update");
  
        if (!isAllowed) {
          var response = {
            status: 401,
            message: "Subadmin does not have permission to add Reports!",
          };
          return res.status(401).send(response);
        }
  
      }
  
    }
    const { Reply,status } = req.body; 

    // Assuming you have a model named Report
    const reportFind = await Report.findOne({ _id: req.params.id }); 

    if (!reportFind) {
      return res.status(404).send({ status: false, message: "Report not found" });
    }

    // 1=admin, 2=employee, 3=dealer, 4=customer
    if (user_type === 1) {
      reportFind.ReplyType = 'Admin';
    } else if (user_type === 3) {
      reportFind.ReplyType = 'Dealer';
    } else {
      reportFind.ReplyType = 'SubAdmin';
    }

    reportFind.Reply = Reply; 
    reportFind.status = status;

    const updatedReport = await reportFind.save(); // Save the updated document

    res.status(200).send({ status: true, message: "Report updated successfully", data: updatedReport });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ status: false, message: "Internal Server Error" });
  }
};

const userReport = async (req, res) => {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    if (user_id == null || (user_type !== 4)) {
      var response = {
        status: 401,
        message: "Admin is unauthorized!",
      };
      return res.status(401).send(response);
    }

    if (user_id) {
      const userReports = await Report.find({user_id});
      res.status(200).send({ status: true, message: 'All user data', data: userReports });
    }else{
      res.status(404).send({status:false,message:"not found your report"})
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send({ status: false, message: "Internal Server Error" });
  }
};

module.exports = {ReportAdd,AllReport,replyAdmin,SingleReport,userReport}


