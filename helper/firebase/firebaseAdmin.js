const admin = require('firebase-admin');
const serviceAccount = require('./drbike-1bd1a-firebase-adminsdk-fiyfv-c918ee06ee.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;