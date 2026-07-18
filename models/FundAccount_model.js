const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);


// Define the schema for the fund account
const fundAccountSchema = new mongoose.Schema({
    contact_id: {
        type: String,
        required: true
    },
    fund_id: {
        type: String,
        required: true
    },
    account_type: {
        type: String,
        required: true
    },
   
        name: {
            type: String,
            required: true
        },
        ifsc: {
            type: String,
            required: true
        },
        account_number: {
            type: String,
            required: true
        },
        
    
    dealerId: {
        type: String,
        ref: 'Vendor'
    }
},{timestamps:true});

// Create a model based on the schema
fundAccountSchema.plugin(AutoIncrement, {id:'fund_seq',inc_field: 'id'});

const FundAccount = mongoose.model('FundAccount', fundAccountSchema);

module.exports = FundAccount;
