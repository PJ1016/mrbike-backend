const feature = require("../models/service_feature");
const service = require("../models/service_model");
const jwt_decode = require("jwt-decode");


// Add Feature to Perticular Service
// req.params.id    ==  Service id
async function addfeature(req, res) {
    try{
      const data = jwt_decode(req.headers.token);
      const user_id = data.user_id;
      const user_type = data.user_type;
      const type = data.type;
        if (user_id == null || user_type != 1 && user_type != 3) {
          var response = {
            status: 401,
            message: "admin is un-authorised !",
          };
          return res.status(401).send(response);
        }

        const{service_id,name,description} = req.body;

        let services = await service.findById(service_id);
        if(!services){
            res.status(401).json({ error: "No Service exists" })
            return;
        }
        if(req.file){
        const datas = {
            name : name,
            image : req.file.location, // S3 URL
            description : description,
            service_id:service_id,
            service_name:services.name
        };
        const featureresponce = await feature.create(datas);

        // feature added to Service
        services.features.push(featureresponce._id);
        await services.save()

        if (featureresponce) {
            var response = {
              status: 200,
              message: "Feature added successfully",
              // data: featureresponce,
              image_base_url: process.env.BASE_URL,
            };
            return res.status(200).send(response);
          } else {
            var response = {
              status: 201,
              message: "Unable to add Feature",
            };
            return res.status(201).send(response);
          }
        } else {
          var response = {
            status: 201,
            message: "please upload service feature image",
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


async function getfeature(req, res) {
    try{
      const data = jwt_decode(req.headers.token);
      const user_id = data.user_id;
      const user_type = data.user_type;
      const type = data.type;
        if (user_id == null || user_type != 1 && user_type != 3 && user_type != 4) {
          var response = {
            status: 401,
            message: "admin is un-authorised !",
          };
          return res.status(401).send(response);
        }


        let featureresponce = await feature.find({_id:req.params.id});
        
        if (featureresponce) {
            var response = {
              status: 200,
              message: "successfull",
              data: featureresponce,
              image_base_url: process.env.BASE_URL,
            };
            return res.status(200).send(response);
          } else {
            var response = {
              status: 201,
              featureresponce,
              message: "No Feature Found",
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


async function getAllfeature(req, res) {
  try{
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    const type = data.type;
      if (user_id == null || user_type != 1 && user_type != 3 && user_type != 4) {
        var response = {
          status: 401,
          message: "admin is un-authorised !",
        };
        return res.status(401).send(response);
      }

      let featureresponce = await feature.find(req.query).sort( { "_id": -1 } );
      
      if (featureresponce) {
          var response = {
            status: 200,
            message: "successfull",
            data: featureresponce,
            image_base_url: process.env.BASE_URL,
          };
          return res.status(200).send(response);
        } else {
          var response = {
            status: 201,
            featureresponce,
            message: "No Feature Found",
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


async function deletefeature(req, res) {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    const type = data.type;
    if (user_id == null || user_type != 1) {
      if(user_type === 3 ){
        var response = {
          status: 201,
          message: "SubAdmin is un-authorised !",
        };
        return res.status(201).send(response);
      } else {
        var response = {
          status: 401,
          message: "Admin is un-authorised !",
        };
        return res.status(401).send(response);
      }
    }

    const { feature_id } = req.body;
    const featureRes = await feature.findOne({ _id: feature_id });
    if (featureRes) {
      feature.findByIdAndDelete({ _id: feature_id }, async function (err, docs) {
        if (err) {
          var response = {
            status: 201,
            message: "Feature delete failed",
          };
          return res.status(201).send(response);
        } else {
          var response = {
            status: 200,
            message: "Feature deleted successfully",
          };
          return res.status(200).send(response);
        }
      });
    } else {
      var response = {
        status: 201,
        message: "Feature not Found",
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


async function editfeature(req, res) {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    const type = data.type;
    if (user_id == null || user_type != 1) {
      if(user_type === 3 ){
        var response = {
          status: 201,
          message: "SubAdmin is un-authorised !",
        };
        return res.status(201).send(response);
      } else {
        var response = {
          status: 401,
          message: "Admin is un-authorised !",
        };
        return res.status(401).send(response);
      }
    }

    const { name, description } = req.body;

    const featureRes = await feature.findOne({ _id: req.params.id });

    if (featureRes) {
      const data = {
        name: name,
        description: description,
        // image: image,
        //update_dt: new Date,
      };
      feature.findByIdAndUpdate(
        { _id: req.params.id },
        { $set: data },
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
              message: "Feature updated successfully",
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
        message: "Feature not Found",
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


module.exports = {
    addfeature,
    getAllfeature,
    getfeature,
    deletefeature,
    editfeature,
}