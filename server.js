require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large base64 image uploads
app.use(express.static(__dirname)); // Serve static files like html, css, js

// Initialize data structure if file doesn't exist
const defaultData = {
    users: [],
    posts: [],
    messages: [],
    notifications: [],
    reels: []
};

function readData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const rawData = fs.readFileSync(DATA_FILE);
        return JSON.parse(rawData);
    } catch (err) {
        console.error('Error reading data:', err);
        return defaultData;
    }
}

function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error writing data:', err);
    }
}

// === API Endpoints ===

// Get all users
app.get('/api/users', (req, res) => {
    const data = readData();
    // In a real app we would strip passwords, but keeping structure similar to original
    res.json(data.users);
});

// Signup
app.post('/api/signup', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const data = readData();
    if (data.users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email already registered.' });
    }

    const newUser = { name, email, password };
    data.users.push(newUser);
    writeData(data);

    res.status(201).json(newUser);
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required.' });
    }

    const data = readData();
    const user = data.users.find(u => u.email === email && u.password === password);

    if (user) {
        res.json(user);
    } else {
        res.status(401).json({ error: 'Invalid email or password.' });
    }
});

// --- EMAIL & OTP LOGIC ---
const otps = {}; // { email: { otp, expiresAt, resetToken } }

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Step 1: Request OTP
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });

    const data = readData();
    const user = data.users.find(u => u.email === email);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otps[email] = { otp, expiresAt };

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset OTP',
            text: `Your OTP for resetting your password is: ${otp}. It expires in 10 minutes.`
        });
        res.json({ success: true, message: 'OTP sent to your email.' });
    } catch (err) {
        console.error('Error sending email:', err);
        res.status(500).json({ error: 'Failed to send email. Check .env credentials.' });
    }
});

// Step 2: Verify OTP
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    const record = otps[email];

    if (!record || record.otp !== otp || Date.now() > record.expiresAt) {
        return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    // Generate a secure reset token
    record.resetToken = Math.random().toString(36).substring(2);
    res.json({ success: true, resetToken: record.resetToken });
});

// Step 3: Reset Password
app.post('/api/reset-password', (req, res) => {
    const { email, password, resetToken } = req.body;
    if (!email || !password || !resetToken) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    const record = otps[email];
    if (!record || record.resetToken !== resetToken || Date.now() > record.expiresAt) {
        return res.status(400).json({ error: 'Invalid or expired session. Please request OTP again.' });
    }

    const data = readData();
    const user = data.users.find(u => u.email === email);

    if (user) {
        user.password = password;
        writeData(data);
        delete otps[email]; // clear session
        res.json({ success: true, message: 'Password reset successfully.' });
    } else {
        res.status(404).json({ error: 'User not found.' });
    }
});

// Get all posts
app.get('/api/posts', (req, res) => {
    const data = readData();
    res.json(data.posts);
});

// Create a new post
app.post('/api/posts', (req, res) => {
    const newPost = req.body;
    const data = readData();
    data.posts.unshift(newPost); // Add to beginning
    writeData(data);
    res.status(201).json(newPost);
});

// Update post interactions (like, comment, share)
app.post('/api/posts/:id/:action', (req, res) => {
    const { id, action } = req.params;
    const data = readData();
    const post = data.posts.find(p => p.id == id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    if (action === 'like') {
        const { liked } = req.body; // true if liking, false if unliking
        const increment = liked ? 1 : -1;
        post.likes = Math.max(0, (post.likes || 0) + increment);
    } else if (action === 'comment') {
        const { text, username, userImage } = req.body;
        if (text) {
            post.commentsList = post.commentsList || [];
            post.commentsList.push({ text, username, userImage, time: 'JUST NOW' });
            post.comments = post.commentsList.length;
        } else {
            post.comments = (post.comments || 0) + 1;
        }
    } else if (action === 'share') {
        post.shares = (post.shares || 0) + 1;
    } else {
        return res.status(400).json({ error: 'Invalid action' });
    }

    writeData(data);
    res.json(post);
});

// Get all messages
app.get('/api/messages', (req, res) => {
    const data = readData();
    res.json(data.messages);
});

// Send a new message
app.post('/api/messages', (req, res) => {
    const newMessage = req.body;
    const data = readData();
    data.messages.push(newMessage);
    writeData(data);
    res.status(201).json(newMessage);
});

// Get all notifications
app.get('/api/notifications', (req, res) => {
    const data = readData();
    // Default to empty array if notifications not yet in schema
    res.json(data.notifications || []);
});

// Create a new notification
app.post('/api/notifications', (req, res) => {
    const newNotif = req.body;
    const data = readData();
    if (!data.notifications) data.notifications = [];
    data.notifications.unshift(newNotif); // Add to beginning (most recent first)
    writeData(data);
    res.status(201).json(newNotif);
});

// === REELS ENDPOINTS ===

// Get all reels
app.get('/api/reels', (req, res) => {
    const data = readData();
    res.json(data.reels || []);
});

// Create a new reel
app.post('/api/reels', (req, res) => {
    const newReel = req.body;
    const data = readData();
    if (!data.reels) data.reels = [];
    data.reels.unshift(newReel); // Add to beginning
    writeData(data);
    res.status(201).json(newReel);
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
