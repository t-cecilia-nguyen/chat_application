const express = require("express");
const GroupMessage = require("../models/GroupMessage");
const PrivateMessage = require("../models/PrivateMessage");

const router = express.Router();

router.get("/users", async (req, res) => {
    try {
        const users = await User.find({}, "username");
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: "Error retrieving users" });
    }
});

router.post("/group", async (req, res) => {
    try {
        const newMessage = new GroupMessage(req.body);
        await newMessage.save();
        res.status(201).json({ message: "Message saved" });
    } catch (err) {
        res.status(500).json({ message: "Error saving message" });
    }
});

router.get("/group/:room", async (req, res) => {
    try {
        const messages = await GroupMessage.find({ room: req.params.room }).sort("date_sent");
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: "Error retrieving messages" });
    }
});

module.exports = router;