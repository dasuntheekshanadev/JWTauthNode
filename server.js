const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const uuid = require('uuid'); 
const config = require('./config');
require('dotenv').config;

const app = express();

// DB_URL = process.env.DATABASE_URI;
//SEC_KEY = process.env.SECRET_KEY;

// Middleware
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect("mongodb+srv://skulcandy:0IP4SDHLQWOpxcOm@cluster0.mvkhdas.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to Stupid MongoDB ( ͜ₒ ㅅ ͜ ₒ)'))
    .catch(err => console.error('Failed to connect to MongoDB', err));

// Customer model
const Customer = mongoose.model('Customer', new mongoose.Schema({
    name: String,
    email: String,
    password: String
}));

// RegistrationToken model for storing token and unique identifier
const RegistrationToken = mongoose.model('RegistrationToken', new mongoose.Schema({
    token: String,
    uniqueIdentifier: String,
    email: String
}));

// Register endpoint
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Check if the email is already registered
        let customer = await Customer.findOne({ email });
        if (customer) return res.status(400).json({ message: 'Email already exists' });

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create customer account
        customer = new Customer({
            name,
            email,
            password: hashedPassword
        });
        await customer.save();

        // Generate JWT token
        const token = jwt.sign({ customerId: customer._id }, '"1@45252FG*()"', { expiresIn: '1h' });

        // Generate a unique identifier (e.g., UUID)
        const uniqueIdentifier = uuid.v4();

        // Save the token and unique identifier in the database
        await RegistrationToken.create({ token, uniqueIdentifier, email });

        // Construct the registration link with the unique identifier
        const registrationLink = `http://localhost:3000/verify-registration?token=${uniqueIdentifier}`;

        // Send registration email with the registration link
        await sendRegistrationEmail(email, registrationLink);

        res.status(200).json({ message: 'Registration email sent. Please check your email for instructions.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Create a new endpoint to handle registration verification
app.get('/verify-registration', async (req, res) => {
    const { token: uniqueIdentifier } = req.query;

    try {
        // Find the token in the database
        const registrationToken = await RegistrationToken.findOne({ uniqueIdentifier });

        if (!registrationToken) {
            return res.status(400).json({ message: 'Invalid registration token' });
        }

        // Verify the JWT token
        jwt.verify(registrationToken.token, '"1@45252FG*()"', (err, decoded) => {
            if (err) {
                return res.status(401).json({ message: 'Unauthorized' });
            } else {
                // Token is valid, complete the registration process for the user
                // Update the user's account status, etc.
                return res.status(200).json({ message: 'Registration verified' });
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

async function sendRegistrationEmail(email, registrationLink) {
    const transporter = nodemailer.createTransport(config);

    const mailOptions = {
        from: config.auth.user,
        to: email,
        subject: 'Registration Link',
        text: `Click the following link to complete your registration: ${registrationLink}`,
    };

    await transporter.sendMail(mailOptions);
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
