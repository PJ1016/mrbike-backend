const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const contactSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true 
    },
    contact: {
        type: String,
        required: true
    },
    dealerId: {
        type: String,
        ref: 'Vendor'
    }
}, { timestamps: true });

contactSchema.plugin(AutoIncrement, { id: 'contact_seq', inc_field: 'id' });
const Contact = mongoose.model('Contact', contactSchema);

module.exports = Contact;
