require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

// Models
const GroupMessage = require("./models/GroupMessage");
const PrivateMessage = require("./models/PrivateMessage");

// Routes
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");

const app = express();
const io = socketIo(app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
}));

app.use(express.json());
app.use(cors());

// View
app.use(express.static(path.join(__dirname, "view")));

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

let roomMembers = {};
const socketUsers = {};

// Socket.io
io.on("connection", (socket) => {
    console.log("New user connected", socket.id);
    let currentUsername = null;
    
    // Join Room
    socket.on("joinRoom", (data) => {
        const {room, username} = data;
        currentUsername = username;
        socketUsers[username] = socket.id;
        socket.join(room);

        io.to(room).emit("roomUpdate", { room, members: Object.keys(socketUsers) });

        // Add user to the roomMembers list
        if (!roomMembers[room]) {
            roomMembers[room] = [];
        }
        roomMembers[room].push(username);
        io.to(room).emit("roomUpdate", { room, members: roomMembers[room] });

        console.log(`"${username}" joined room "${room}"`);

        const currentTimestamp = new Date().toISOString();

        io.to(room).emit("chatMessage", {
            from_user: "Admin",
            message: `${username} has joined the room`,
            room: room,
            date_sent: currentTimestamp
        });
    });

    // Send Message
    socket.on("chatMessage", async (data) => {
        console.log("Received message:", data);

        const { from_user, room, message } = data;
        const newMessage = new GroupMessage({ 
            from_user, 
            room, 
            message, 
            date_sent: new Date().toISOString() });
        await newMessage.save();

        console.log("Message saved with date_sent:", newMessage.date_sent);
        io.to(room).emit('chatMessage', {
            from_user: from_user,
            message: message,
            room: room,
            date_sent: newMessage.date_sent
        });
    });

    // Handle Private Messages
    socket.on("privateMessage", async (data) => {
        const { from_user, to_user, message, room } = data;
    
        // Save message to MongoDB
        const newMessage = new PrivateMessage({
            from_user,
            to_user,
            message,
            room,
        });
    
        try {
            await newMessage.save(); // Save to MongoDB
            console.log("Private message saved to DB");
    
            const recipientSocketId = socketUsers[to_user];
            if (recipientSocketId) {
                io.to(recipientSocketId).emit("privateMessage", data);
            }
        } catch (err) {
            console.error("Error saving message:", err);
        }
    });

    // Leave Room
    socket.on("leaveRoom", (room) => {
        if (currentUsername && roomMembers[room]) {
            // Remove the user from the room's member list
            roomMembers[room] = roomMembers[room].filter(user => user !== currentUsername);
            io.to(room).emit("roomUpdate", { room, members: roomMembers[room] });
        }

        // Leave the room
        console.log(`"${currentUsername}" left room "${room.room}"`);
        socket.leave(room);
        delete socketUsers[username]; // Remove user from the map
    });

    // Disconnect
    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});