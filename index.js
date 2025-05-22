const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const clientRoutes = require('./routes/clientRoutes');
const taskRoutes = require('./routes/taskRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const { errorHandler } = require('./utils/errorHandler');

// Load environment variables
const dotenv = require('dotenv');
dotenv.config();

const app = express();

// Configure multer for form-data (no file uploads, only fields)
const upload = multer();

// Middleware
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:8080'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(upload.none());
app.use(cookieParser());

// Log incoming request details for debugging
app.use((req, res, next) => {
  console.log('Incoming request:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    cookies: req.cookies
  });
  next();
});
// Log incoming request details for debugging
app.use((req, res, next) => {
  console.log('Incoming request:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/payments', paymentRoutes);

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});