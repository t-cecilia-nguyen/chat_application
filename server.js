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
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(cors());

// View
app.use(express.static(path.join(__dirname, "view")));

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

let roomMembers = {};

// Socket.io
io.on("connection", (socket) => {
    console.log("New user connected", socket.id);
    let currentUsername = null;
    // Join Room
    socket.on("joinRoom", (data) => {

        const {room, username} = data;
        currentUsername = username;

        socket.join(room);

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

    // Leave Room
    socket.on("leaveRoom", (room) => {
        if (currentUsername && roomMembers[room]) {
            // Remove the user from the room's member list
            roomMembers[room] = roomMembers[room].filter(user => user !== currentUsername);
            io.to(room).emit("roomUpdate", { room, members: roomMembers[room] });
        }

        // Leave the room
        socket.leave(room);
        console.log(`"${currentUsername}" left room "${room}"`);
    });

    // Disconnect
    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));