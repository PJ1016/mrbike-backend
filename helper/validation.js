
/* eslint-disable camelcase */
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
// import env from '../../env';
/**
   * Hash Password Method
   * @param {string} password
   * @returns {string} returns hashed password
   */

// viren
const saltRounds = 10;
const salt = bcrypt.genSaltSync(saltRounds);
const hashPassword = password => bcrypt.hashSync(password, salt);
/**
   * comparePassword
   * @param {string} hashPassword
   * @param {string} password
   * @returns {Boolean} return True or False
   */
//viren
const comparePassword = (hashedPassword, password) => {
  return bcrypt.compareSync(password, hashedPassword);
};
//end viren

/**
   * isValidEmail helper method
   * @param {string} email
   * @returns {Boolean} True or False
   */
const isValidEmail = (email) => {
  const regEx = /\S+@\S+\.\S+/;
  return regEx.test(email);
};

/**
   * validatePassword helper method
   * @param {string} password
   * @returns {Boolean} True or False
   */
const validatePassword = (password) => {
  if (password.length <= 5 || password === '') {
    return false;
  } return true;
};
/**
   * isEmpty helper method
   * @param {string, integer} input
   * @returns {Boolean} True or False
   */
const isEmpty = (input) => {
  if (input === undefined || input === '') {
    return true;
  }
  if (input.replace(/\s/g, '').length) {
    return false;
  } return true;
};

/**
   * empty helper method
   * @param {string, integer} input
   * @returns {Boolean} True or False
   */
const empty = (input) => {
  if (input === undefined || input === '') {
    return true;
  }
};


const foreach = (arr, func) => {
  for (var i in arr) {
    func(i, arr[i]);
  }
}
const arrayColumn = (array, columnName) => {
  return array.map(function (value, index) {
    return value[columnName];
  })
}
const foreAch = (collection, callback, scope) => {
  if (Object.prototype.toString.call(collection) === '[object Object]') {
    for (var prop in collection) {
      if (Object.prototype.hasOwnProperty.call(collection, prop)) {
        callback.call(scope, collection[prop], prop, collection);
      }
    }
  } else {
    for (var i = 0, len = collection.length; i < len; i++) {
      callback.call(scope, collection[i], i, collection);
    }
  }
};
const deg2rad = (deg) => {
  return deg * (Math.PI / 180)
}

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

/**
   * Generate Token
   * @param {string} id
   * @returns {string} token
   */
// const generateUserToken = (email, id, mobileno, name, type, user_type) => {
//   console.log(name);
//   const token = jwt.sign({
//     email,
//     user_id: id,
//     mobileno,
//     name,
//     type,
//     user_type,
//   },
//     'sk_digi',{ expiresIn: '3d' });
//   return token;
// };

const generateUserToken = (id,type, user_type) => {
  const token = jwt.sign({
    user_id: id,
    type,
    user_type,
  },
    process.env.JWT_SECRET,
    { expiresIn: '60000d' }
  );
  return token;
};


const findIndexByProperty = (data, key, value) => {
  for (var i = 0; i < data.length; i++) {
    if (data[i][key] == value) {
      return i;
    }
  }
  return -1;
}

/**
 * isValidPhone helper method
 * @param {string} phone
 * @returns {Boolean} True or False
 */
const isValidPhone = (phone) => /^\d{10}$/.test(String(phone).trim());

/**
 * isValidGender helper method
 * @param {string} gender
 * @returns {Boolean} True or False
 */
const isValidGender = (gender) => {
  if (typeof gender !== 'string') return false;
  return ['male', 'female', 'other'].includes(gender.trim().toLowerCase());
};

/**
 * isValidLatitude helper method
 * @param {number} lat
 * @returns {Boolean} True or False
 */
const isValidLatitude = (lat) => !isNaN(lat) && lat >= -90 && lat <= 90;

/**
 * isValidLongitude helper method
 * @param {number} lng
 * @returns {Boolean} True or False
 */
const isValidLongitude = (lng) => !isNaN(lng) && lng >= -180 && lng <= 180;

/**
 * isValidCommission helper method
 * @param {number} value
 * @returns {Boolean} True or False
 */
const isValidCommission = (value) => !isNaN(value) && value >= 0 && value <= 100;

/**
 * isValidTax helper method
 * @param {number} value
 * @returns {Boolean} True or False
 */
const isValidTax = (value) => !isNaN(value) && value >= 0 && value <= 18;

/**
 * isValidIFSC helper method
 * @param {string} ifsc
 * @returns {Boolean} True or False
 */
const isValidIFSC = (ifsc) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(ifsc).trim().toUpperCase());

/**
 * isValidBankAccountNumber helper method
 * @param {string} accountNumber
 * @returns {Boolean} True or False
 */
const isValidBankAccountNumber = (accountNumber) => /^\d{9,18}$/.test(String(accountNumber).trim());

/**
 * isValidPAN helper method
 * @param {string} pan
 * @returns {Boolean} True or False
 */
const isValidPAN = (pan) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(String(pan).trim().toUpperCase());

module.exports = {
  hashPassword,
  comparePassword,
  isValidEmail,
  validatePassword,
  isEmpty,
  empty,
  foreach,
  arrayColumn,
  foreAch,
  getDistanceFromLatLonInKm,
  findIndexByProperty,
  generateUserToken,
  isValidPhone,
  isValidGender,
  isValidLatitude,
  isValidLongitude,
  isValidCommission,
  isValidTax,
  isValidIFSC,
  isValidBankAccountNumber,
  isValidPAN,
};
