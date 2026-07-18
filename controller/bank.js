var Bank = require("../models/Bank");
const jwt_decode = require("jwt-decode");
const fetch = require("node-fetch");
const Vendor = require("../models/dealerModel");


async function addBank(req, res) {
  // created by  dealer
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    if (user_id == null || user_type != 1 && user_type != 2) {
      var response = {
        status: 401,
        message: "admin is un-authorised !",
      };
      return res.status(401).send(response);
    }

    const dealer = await Vendor.findById(user_id);

    console.log(dealer);
    const { accountno, bankname, ifsc, location, accholdername } = req.body;

    if(accountno =='' || bankname =='' || ifsc =='' || location =='' || accholdername =='')
    {
        var response = {
            status: 201,
            message: "please enter all the fields",
          };
    
        return res.status(201).send(response);
    }

    const datas = {
        accountno: accountno,
        bankname: bankname,
        ifsc: ifsc,
        location: location,
        accholdername:accholdername,
        dealer_id:user_id,
        dealer_name:dealer.shopName,
        dealer_city:dealer.city
      };
      const bankresponce = await Bank.create(datas);
      if (bankresponce) {
        var response = {
          status: 200,
          message: "Bank added successfully",
          data: datas,
        };
        return res.status(200).send(response);
      } else {
        var response = {
          status: 201,
          message: "Unable to add Bank",
        };
        return res.status(201).send(response);
      }
    
  } catch (error) {
    console.log("error", error);
    response = {
      status: 201,
      message: "Operation was not successful",
    };

    return res.status(201).send(response);
  }
}


async function banklist(req, res) {
  try {
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
    
    var bankResposnse = await Bank.find(req.query);

    if (bankResposnse.length !=0) {
        var response = {
          status: 200,
          message: "successfull",
          data: bankResposnse,
        };
        return res.status(200).send(response);
      } else {
        var response = {
          status: 201,
          bankResposnse,
          message: "No bank Found",
        };
        return res.status(201).send(response);
      }
  } catch (error) {
    console.log("error", error);
    response = {
      status: 201,
      message: "Operation was not successful",
    };

    return res.status(201).send(response);
  }
}


async function deletebank(req, res) {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    const type = data.type;
    if (user_id == null || user_type != 1 && user_type != 2 && user_type != 3) {
        var response = {
        status: 401,
        message: "Admin is un-authorised !",
      };
      return res.status(401).send(response);
    }

    const { bank_id } = req.body;

    const bankRes = await Bank.findOne({ _id: bank_id });
    
    if (bankRes) {
        Bank.findByIdAndDelete({ _id: bank_id }, async function (err, docs) {
        if (err) {
          var response = {
            status: 201,
            message: "bank delete failed",
          };
          return res.status(201).send(response);
        } else {
          var response = {
            status: 200,
            message: "bank deleted successfully",
          };
          return res.status(200).send(response);
        }
      });
    } else {
      var response = {
        status: 201,
        message: "bank not Available",
      };

      return res.status(201).send(response);
    }
  } catch (error) {
    console.log("error", error);
    response = {
      status: 201,
      message: "Operation was not successful",
    };
    return res.status(201).send(response);
  }
}


async function editbank(req, res) {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    const type = data.type;
    if (user_id == null || user_type != 1 && user_type != 2 && user_type != 3) {
        var response = {
        status: 401,
        message: "Admin is un-authorised !",
      };
      return res.status(401).send(response);
    }

    const { bank_id, accountno, bankname, ifsc, location, accholdername } = req.body;
    
    const bankRes = await Bank.findOne({ _id: bank_id });

    if (bankRes) {
      const datas = {
        accountno: accountno,
        bankname: bankname,
        ifsc: ifsc,
        location: location,
        accholdername:accholdername,
      };
      Bank.findByIdAndUpdate(
        { _id: bank_id },
        { $set: datas },
        { new: true },
        async function (err, docs) {
          if (err) {
            var response = {
              status: 201,
              message: err,
            };
            return res.status(201).send(response);
          } else {
            var response = {
              status: 200,
              message: "bank updated successfully",
              data: docs,
              image_base_url: process.env.BASE_URL,
            };
            return res.status(200).send(response);
          }
        }
      );
    } else {
      response = {
        status: 201,
        message: "Bank not available",
      };
      return res.status(201).send(response);
    }
  } catch (error) {
    console.log("error", error);
    response = {
      status: 201,
      message: "Operation was not successful",
    };
    return res.status(201).send(response);
  }
}


async function getAllBank(req, res) {
  try{
      await fetch("https://raw.githubusercontent.com/AnilNITT/Bank-n-ifsc/master/Bank.json")
      .then(res=>res.json())
      .then(data=>{
          let banks =[]
          // data.forEach(datas=>{
          //     cities.push(datas.state)
          //     return cities
          // })
          data.forEach(datas=>{
            // console.log(Object.keys(datas));
            banks.push(Object.keys(datas))
            return banks
        })
          var responsess = {
              status: 200,
              message: "successfull",
              data: banks[0],
          };
          return res.status(200).send(responsess);
      })
      .catch(err=>{
          return res.status(401).send(err);
      })
  } catch (error) {
      console.log("error", error);
      response = {
        status: 201,
        message: "Operation was not successful",
      };
  
      return res.status(201).send(response);
    }
}


module.exports = {
  addBank,
  banklist,
  deletebank,
  editbank,
  getAllBank,
};


