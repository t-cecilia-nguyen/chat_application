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

// Socket.io
io.on("connection", (socket) => {
    console.log("New user connected", socket.id);

    // Join Room
    socket.on("joinRoom", (data) => {

        const currentTimestamp = new Date().toISOString();

        const {room, username} = data;
        socket.join(room);
        console.log(`"${username}" joined room "${room}"`);

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

    // Send Private Message
    socket.on("privateMessage", async (data) => {
        const { from_user, to_user, message } = data;
        const newMessage = new PrivateMessage({ from_user, to_user, message });
        await newMessage.save();

        io.to(to_user).emit("privateMessage", { from_user, message });
    });

    // Typing Indicator
    socket.on("typing", (room, user) => {
        socket.to(room).emit("typing... ", user);
    });

    // Leave Room
    socket.on("leaveRoom", (room) => {
        socket.leave(room);
    });

    // Disconnect
    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));