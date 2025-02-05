const mongoose = require("mongoose");

const PrivateMessageSchema = new mongoose.Schema({
    from_user: String,
    to_user: String,
    message: String,
    date_sent: { type: Date, default: Date.now }
});

module.exports = mongoose.model("PrivateMessage", PrivateMessageSchema);