/* eslint-disable max-len */
const jwt = require('jsonwebtoken');
const jwt_decode = require("jwt-decode");
const Dealer = require("../models/Dealer");

// import env from '../../env';


/**
   * Verify Token
   * @param {object} req 
   * @param {object} res 
   * @param {object} next
   * @returns {object|void} response object 
*/


function verifyToken(req, res, next){

  const { token } = req.headers;
  //const { token } = req.cookies;

  if (!token) {

    var responseErr = {
        status : 401,
        message:'Token not provided'
      };
      return res.status(401).send(responseErr);
  }
  try {
    const decoded =  jwt.verify(token, process.env.JWT_SECRET);
    if (decoded) {

       if (decoded.type === 'logged') {
          req['user_id'] = decoded.user_id;
          // req['email'] = decoded.email;
          req['type'] = decoded.type;   // type = 1 user type = 2 vendor
          // req['name'] = decoded.name;   
          req['user_type'] = decoded.user_type; // user_type = (1=admin, 2=employee, 3=dealer, 4=customer)
         
            next();
      }else{
         req.user = {
            // email: decoded.email,
            user_id: decoded.user_id,
            type: decoded.type,
            user_type: decoded.user_type,
          };
          next();
      }
    }
      
   
  } catch (error) {
    var responseErr = {
        status : 401,
        message:'Authentication Failed'
      };
      return res.status(401).send(responseErr);
  }
};

async function verifyUser(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ success: false, message: "Not authorized. Login first." });
  }

  try {
    const data = jwt_decode(token);

    if (!data || !data.mobile) {
      return res.status(400).json({ success: false, message: "Invalid token data: missing mobile" });
    }

    const user = await Dealer.findOne({ mobile: data.mobile });

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found with this mobile number" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("verifyUser error:", error);
    return res.status(401).json({ status: 401, message: "Authentication failed" });
  }
}

module.exports =   { verifyToken, verifyUser }