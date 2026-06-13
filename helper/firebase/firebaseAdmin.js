const admin = require('firebase-admin');
const serviceAccount = require('./mr-bike-48729-firebase-adminsdk-fbsvc-515c54e0f0.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;