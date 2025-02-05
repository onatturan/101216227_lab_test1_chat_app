const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the "views" folder
app.use(express.static(path.join(__dirname, 'views')));

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/chat_app', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('MongoDB connected successfully');
}).catch((err) => {
    console.error('MongoDB connection error:', err.message);
});

// User schema and model
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    password: { type: String, required: true },
    createdOn: { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema);

// Message schema and model
const messageSchema = new mongoose.Schema({
    from_user: { type: String, required: true },
    room: { type: String, required: true },
    message: { type: String, required: true },
    date_sent: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', messageSchema);

// Signup route
app.post('/signup', async (req, res) => {
    const { username, firstname, lastname, password } = req.body;

    if (!username || !firstname || !lastname || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const newUser = new User({ username, firstname, lastname, password });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error registering user', error: err.message });
    }
});

// Login route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username, password });
        if (!user) {
            return res.status(400).json({ message: 'Invalid username or password' });
        }
        res.status(200).json({ message: 'Login successful', username });
    } catch (err) {
        res.status(500).json({ message: 'Error logging in', error: err.message });
    }
});

// Fetch messages for a room
app.get('/messages/:room', async (req, res) => {
    const { room } = req.params;
    try {
        const messages = await Message.find({ room }).sort({ date_sent: 1 });
        res.status(200).json(messages);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching messages', error: err.message });
    }
});

// Fallback route for chatroom.html
app.get('/chatroom', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'chatroom.html'));
});

// Create HTTP server and integrate Socket.IO
const server = http.createServer(app);
const io = new Server(server);

// WebSocket logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join a room
    socket.on('joinRoom', (room) => {
        socket.join(room);
        socket.room = room;
        console.log(`User ${socket.id} joined room: ${room}`);
        socket.emit('message', { username: 'System', message: `Welcome to the ${room} room!` });
        socket.to(room).emit('message', { username: 'System', message: `A new user has joined the ${room} room.` });
    });

    // Leave a room
    socket.on('leaveRoom', () => {
        if (socket.room) {
            socket.leave(socket.room);
            console.log(`User ${socket.id} left room: ${socket.room}`);
            socket.to(socket.room).emit('message', { username: 'System', message: 'A user has left the room.' });
            socket.room = null;
        }
    });

    // Handle chat messages
    socket.on('chatMessage', async (data) => {
        if (!socket.room) {
            console.error('User is not in any room');
            return;
        }

        try {
            // Save the message to MongoDB
            const newMessage = new Message({
                from_user: data.username,
                room: socket.room,
                message: data.message,
            });

            await newMessage.save();

            // Emit the message to all users in the room
            io.to(socket.room).emit('message', {
                username: data.username,
                message: data.message,
                room: socket.room,
            });
        } catch (err) {
            console.error('Error saving message:', err.message);
        }
    });

    // Typing indicator
    socket.on('typing', (data) => {
        if (socket.room) {
            socket.to(socket.room).emit('typing', { username: data.username });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
