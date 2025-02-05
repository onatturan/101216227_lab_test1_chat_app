const express = require('express');
const router = express.Router();
const User = require('../models/User'); // User modelini ekliyoruz

// Kayıt olma endpoint'i
// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // User validation
        const user = await User.findOne({ username, password });
        if (!user) {
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        res.status(200).json({ message: 'Login successful', username });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router;
