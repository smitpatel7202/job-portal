// ============================================
// ENHANCED BACKEND - PHASE 2 & 3
// Professional Job Portal with All Features
// ============================================

// Load environment variables from .env (ensure this runs before reading process.env)
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Job Portal API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// MIDDLEWARE
// ============================================

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
 
    // In production, allow your Netlify domain
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'https://your-frontend-domain.netlify.app' // Replace with your Netlify URL
    ];
 
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
 
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
 
app.use(cors(corsOptions));
app.use(express.json());

const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (user && user.isBlocked) {
      return res.status(403).json({ error: 'Your account has been blocked. Please contact support.' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const roleMiddleware = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access forbidden. Insufficient permissions.' });
    }
    next();
  };
};

app.get('/uploads/resumes/:filename', (req, res, next) => {
  if (!req.header('Authorization') && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, authMiddleware, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // For Cloudinary, we'll redirect to the secure URL
    const publicId = `job-portal/resumes/${filename}`;
    
    let isAllowed = false;

    if (req.user.role === 'admin' || req.user.role === 'employer') {
      isAllowed = true;
    } else {
      const user = await User.findOne({ _id: req.user.id });
      if (user && user.resume && user.resume.includes(filename)) {
        isAllowed = true;
      }
    }

    if (!isAllowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate secure Cloudinary URL
    const secureUrl = cloudinary.url(publicId, {
      secure: true,
      resource_type: 'auto',
      flags: 'attachment'
    });

    res.json({ url: secureUrl });
  } catch (error) {
    console.error('Resume download error:', error);
    res.status(500).json({ error: 'Failed to generate resume URL' });
  }
});

// Serve static files from uploads, but exclude resumes (they need authentication)
app.use('/uploads', (req, res, next) => {
  // Block direct access to resumes - they must go through the authenticated route
  // if (req.path.startsWith('/resumes/')) {
  //   return res.status(403).json({ error: 'Access denied. Resumes require authentication.' });
  // }
  next();
}, express.static(process.env.UPLOAD_DIR || 'uploads'));



// ============================================
// CLOUDINARY CONFIGURATION
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: (req, file) => {
      if (file.fieldname === 'resume') return 'job-portal/resumes';
      else if (file.fieldname === 'logo') return 'job-portal/logos';
      else if (file.fieldname === 'profilePic') return 'job-portal/profile-pics';
      return 'job-portal/others';
    },
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx'],
    public_id: (req, file) => {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return uniqueName;
    }
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'resume') {
      if (file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, DOC, and DOCX are allowed.'));
      }
    } else {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only images are allowed for logos/profile pics.'));
      }
    }
  }
});

// ============================================
// EMAIL CONFIGURATION
// ============================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmail(to, subject, html) {
  try {
    if (!process.env.EMAIL_USER) {
      console.log('Email not configured - skipping:', subject);
      return;
    }
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html
    });
    console.log(`Email sent to ${to}: ${subject}`);
  } catch (error) {
    console.error('Email error:', error.message);
  }
}

// ============================================
// DATABASE CONNECTION
// ============================================
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://jobuser:jobportal123@cluster0.iatff3a.mongodb.net/?appName=Cluster0';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '-refresh';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ============================================
// ENHANCED DATABASE SCHEMAS
// ============================================

// User Schema (Enhanced)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['jobseeker', 'employer', 'admin'], default: 'jobseeker' },
  phone: { type: String },
  location: { type: String },
  profilePic: { type: String },
  isVerified: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  refreshToken: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },

  // Job Seeker Specific
  resume: { type: String },
  skills: [{ type: String }],
  experience: [{
    title: String,
    company: String,
    startDate: Date,
    endDate: Date,
    current: Boolean,
    description: String
  }],
  education: [{
    degree: String,
    institution: String,
    startDate: Date,
    endDate: Date,
    grade: String
  }],
  preferredLocation: [{ type: String }],
  expectedSalary: { type: String },
  profileCompletion: { type: Number, default: 20 },

  // Employer Specific
  companyName: { type: String },
  companyWebsite: { type: String },
  companyLogo: { type: String },
  industry: { type: String },
  companySize: { type: String },
  companyDescription: { type: String },
  gstNumber: { type: String },

  createdAt: { type: Date, default: Date.now }
});

// Job Schema (Enhanced)
const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  company: { type: String, required: true },
  location: { type: String, required: true },
  salary: { type: String },
  type: { type: String, enum: ['Full-time', 'Part-time', 'Internship', 'Contract'], default: 'Full-time' },
  category: { type: String, required: true },
  requiredSkills: [{ type: String }],
  experienceLevel: { type: String, enum: ['Entry', 'Mid', 'Senior', 'Lead'], default: 'Entry' },
  openings: { type: Number, default: 1 },
  workMode: { type: String, enum: ['Remote', 'On-site', 'Hybrid'], default: 'On-site' },
  applicationDeadline: { type: Date },

  // Moderation
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'closed'], default: 'pending' },
  rejectionReason: { type: String },

  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  views: { type: Number, default: 0 },
  applicationsCount: { type: Number, default: 0 },
  lastEmployerView: { type: Date },
  createdAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Application Schema (Enhanced)
const applicationSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'shortlisted', 'rejected', 'accepted'], default: 'pending' },
  coverLetter: { type: String },
  resumeUsed: { type: String },
  appliedAt: { type: Date, default: Date.now },
  statusUpdatedAt: { type: Date, default: Date.now },
  employerNotes: { type: String }
});

// Notification Schema
const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['job', 'application', 'system'], default: 'system' },
  read: { type: Boolean, default: false },
  link: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Job = mongoose.model('Job', jobSchema);
const Application = mongoose.model('Application', applicationSchema);
const Notification = mongoose.model('Notification', notificationSchema);

// ============================================
// HELPER FUNCTIONS
// ============================================

// Calculate profile completion
function calculateProfileCompletion(user) {
  let score = 20; // Base score for registration

  if (user.role === 'jobseeker') {
    if (user.phone) score += 10;
    if (user.location) score += 10;
    if (user.resume) score += 20;
    if (user.skills && user.skills.length > 0) score += 15;
    if (user.education && user.education.length > 0) score += 15;
    if (user.experience && user.experience.length > 0) score += 10;
  } else if (user.role === 'employer') {
    // Required fields for 100% completion (GST and Logo are optional)
    if (user.companyName) score += 20;
    if (user.companyWebsite) score += 15;
    if (user.industry) score += 15;
    if (user.companySize) score += 15;
    if (user.companyDescription) score += 35;
    // Optional fields (not counted for completion)
    // Logo and GST are optional
  }

  return Math.min(score, 100);
}

// Check if employer profile is complete (100%)
function isEmployerProfileComplete(user) {
  return calculateProfileCompletion(user) === 100 &&
    user.companyName &&
    user.companyWebsite &&
    user.industry &&
    user.companySize &&
    user.companyDescription;
}

// Create notification
async function createNotification(userId, title, message, type, link) {
  try {
    const notification = new Notification({ userId, title, message, type, link });
    await notification.save();
  } catch (error) {
    console.error('Notification error:', error);
  }
}



// ============================================
// AUTH ROUTES (Enhanced)
// ============================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'jobseeker',
      isVerified: role === 'admin' ? true : false
    });

    await user.save();

    // Send welcome email
    const emailHtml = `
      <h2>Welcome to Job Portal!</h2>
      <p>Hi ${name},</p>
      <p>Your account has been created successfully as a <strong>${role || 'jobseeker'}</strong>.</p>
      ${role === 'employer' ? '<p><strong>Note:</strong> Your account requires admin verification before you can post jobs.</p>' : ''}
      <p>Start exploring opportunities today!</p>
    `;
    await sendEmail(email, 'Welcome to Job Portal', emailHtml);

    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({ error: 'Your account has been blocked. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        profileCompletion: user.profileCompletion
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Refresh token
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const newToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// Logout
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    // If validation error from mongoose, return 400 with details
    if (error && error.name === 'ValidationError') {
      const details = {};
      for (const key in error.errors) {
        details[key] = error.errors[key].message;
      }
      if (!res.headersSent) return res.status(400).json({ error: 'Validation failed', details });
      console.error('Validation error but headers already sent:', details);
      return;
    }

    console.error('Post job error:', error && error.stack ? error.stack : error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server error', details: error.message });
    } else {
      console.error('Cannot send 500 response, headers already sent');
    }
  }
});

// Request password reset
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists for security
      return res.json({ message: 'If an account exists, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const emailHtml = `
      <h2>Password Reset Request</h2>
      <p>Hi ${user.name},</p>
      <p>You requested to reset your password. Click the link below to reset it:</p>
      <p><a href="${resetUrl}" style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;
    await sendEmail(user.email, 'Password Reset Request', emailHtml);

    res.json({ message: 'If an account exists, a password reset link has been sent.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.resetPasswordToken !== token || user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Update password
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send confirmation email
    const emailHtml = `
      <h2>Password Reset Successful</h2>
      <p>Hi ${user.name},</p>
      <p>Your password has been successfully reset.</p>
      <p>If you didn't make this change, please contact support immediately.</p>
    `;
    await sendEmail(user.email, 'Password Reset Successful', emailHtml);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// PROFILE ROUTES
// ============================================

// Get user profile
app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshToken');
    user.profileCompletion = calculateProfileCompletion(user);
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update profile
app.put('/api/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const wasVerified = user.isVerified;
    const previousCompletion = user.profileCompletion || 0;

    // Update allowed fields
    const allowedUpdates = ['name', 'phone', 'location', 'skills', 'experience', 'education',
      'preferredLocation', 'expectedSalary', 'companyName', 'companyWebsite',
      'industry', 'companySize', 'companyDescription', 'gstNumber'];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    user.profileCompletion = calculateProfileCompletion(user);

    // If employer profile becomes 100% complete, reset verification status for admin review
    if (user.role === 'employer' && user.profileCompletion === 100 && previousCompletion < 100) {
      user.isVerified = false; // Reset to false so admin can review

      // Notify admins
      const admins = await User.find({ role: 'admin' });
      for (const admin of admins) {
        await createNotification(
          admin._id,
          'Employer Profile Completed',
          `${user.companyName || user.name} has completed their profile and is ready for review.`,
          'system',
          `/admin/employers/unverified`
        );
      }
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user,
      requiresAdminReview: user.role === 'employer' && user.profileCompletion === 100 && !user.isVerified
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload resume
app.post('/api/profile/resume', authMiddleware, roleMiddleware('jobseeker'), upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const user = await User.findById(req.user.id);
    if (user.resume) {
      try {
        const oldFilename = path.basename(user.resume);
        const oldPath = path.join(process.env.UPLOAD_DIR || 'uploads', 'resumes', oldFilename);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (err) {
        console.error('Error deleting old resume:', err);
      }
    }

    user.resume = `/uploads/resumes/${req.file.filename}`;
    user.profileCompletion = calculateProfileCompletion(user);
    await user.save();

    res.json({ message: 'Resume uploaded successfully', resume: user.resume });
  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Upload company logo
app.post('/api/profile/logo', authMiddleware, roleMiddleware('employer'), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const user = await User.findById(req.user.id);

    if (user.companyLogo) {
      const oldPath = path.join(__dirname, user.companyLogo);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    user.companyLogo = `/uploads/logos/${req.file.filename}`;
    user.profileCompletion = calculateProfileCompletion(user);
    await user.save();

    res.json({ message: 'Logo uploaded successfully', logo: user.companyLogo });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// JOB ROUTES (Enhanced with Moderation)
// ============================================

// Get all approved jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const { category, type, location, search } = req.query;
    const query = { status: 'approved' };

    if (category) query.category = category;
    if (type) query.type = type;
    if (location) query.location = new RegExp(location, 'i');
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { company: new RegExp(search, 'i') }
      ];
    }

    const jobs = await Job.find(query)
      .populate('postedBy', 'name companyName companyLogo isVerified')
      .sort({ createdAt: -1 });

    // Filter jobs based on openings filled (deadline logic removed from public view)
    const availableJobs = await Promise.all(jobs.map(async (job) => {
      const jobObj = job.toObject();
      
      // Check if application deadline has passed (end of the deadline day)
      if (job.applicationDeadline) {
        const deadline = new Date(job.applicationDeadline);
        deadline.setHours(23, 59, 59, 999); // Set to end of deadline day
        if (deadline < new Date()) {
          return null;
        }
      }
      
      // Count filled positions (shortlisted + accepted applications)
      const filledPositions = await Application.countDocuments({
        jobId: job._id,
        status: { $in: ['shortlisted', 'accepted'] }
      });
      
      // Hide job if all openings are filled
      if (job.openings && filledPositions >= job.openings) {
        return null;
      }
      
      jobObj.filledPositions = filledPositions;
      jobObj.availablePositions = job.openings ? job.openings - filledPositions : 'Unlimited';
      
      return jobObj;
    }));

    // Filter out null values (jobs that should be hidden)
    const visibleJobs = availableJobs.filter(job => job !== null);
    
    res.json(visibleJobs);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single job by ID
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate(
        'postedBy',
        'name email companyName companyLogo companyWebsite isVerified industry companySize'
      );

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if application deadline has passed (end of the deadline day)
    if (job.applicationDeadline) {
      const deadline = new Date(job.applicationDeadline);
      deadline.setHours(23, 59, 59, 999); // Set to end of deadline day
      if (deadline < new Date()) {
        return res.status(404).json({ error: 'Job application deadline has passed' });
      }
    }
    
    // Count filled positions (shortlisted + accepted applications)
    const filledPositions = await Application.countDocuments({
      jobId: job._id,
      status: { $in: ['shortlisted', 'accepted'] }
    });
    
    // Hide job if all openings are filled
    if (job.openings && filledPositions >= job.openings) {
      return res.status(404).json({ error: 'All positions for this job have been filled' });
    }

    // Check if user has permission to view full details
    const authHeader = req.header('Authorization');
    let user = null;
    let hasPermission = false;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        user = await User.findById(decoded.id);
        
        if (user) {
          // Employers can always view their own jobs
          if (user.role === 'employer' && job.postedBy._id.toString() === user._id.toString()) {
            hasPermission = true;
          }
          // Admins can view all jobs
          else if (user.role === 'admin') {
            hasPermission = true;
          }
          // Job seekers can view full details if job is still accepting applications
          else if (user.role === 'jobseeker') {
            // All job seekers can view full details while job is accepting applications
            hasPermission = true;
          }
        }
      } catch (error) {
        // Invalid token - continue with limited access
      }
    } else {
      // Non-authenticated users can view full details while job is accepting applications
      hasPermission = true;
    }

    const jobObj = job.toObject();
    jobObj.filledPositions = filledPositions;
    jobObj.availablePositions = job.openings ? job.openings - filledPositions : 'Unlimited';
    
    // Return full details for all users while job is accepting applications
    res.json(jobObj);
    
    // Update view count
    job.views = (job.views || 0) + 1;
    await job.save();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});


// Post job (requires verification for employers)
app.post('/api/jobs', authMiddleware, roleMiddleware('employer'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Check if profile is complete
    const profileCompletion = calculateProfileCompletion(user);
    if (profileCompletion < 100) {
      return res.status(403).json({
        error: 'Please complete your profile (100%) before posting jobs. Current completion: ' + profileCompletion + '%',
        profileCompletion
      });
    }

    // Check if profile is verified by admin
    if (!user.isVerified) {
      return res.status(403).json({ error: 'Your profile is pending admin review. You can post jobs after admin approval.' });
    }

    const { title, description, company, location, salary, type, category,
      requiredSkills, experienceLevel, openings, workMode, applicationDeadline } = req.body;

    if (!title || !description || !company || !location || !category) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }

    const job = new Job({
      title, description, company, location, salary, type, category,
      requiredSkills, experienceLevel, openings, workMode, applicationDeadline,
      postedBy: req.user.id,
      status: 'pending' // Goes to admin approval
    });

    await job.save();

    // Notify admins
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await createNotification(
        admin._id,
        'New Job Posted',
        `${company} posted a new job: ${title}`,
        'job',
        `/admin/jobs/${job._id}`
      );
    }

    res.status(201).json({
      message: 'Job submitted for admin approval',
      job
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get employer's jobs
app.get('/api/employer/jobs', authMiddleware, roleMiddleware('employer'), async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user.id }).sort({ createdAt: -1 });
    
    // Add new applications information and status to each job
    const jobsWithInfo = await Promise.all(jobs.map(async (job) => {
      const jobObj = job.toObject();
      
      // Check for new applications (applied after last employer view)
      const newApplications = await Application.find({
        jobId: job._id,
        status: 'pending',
        appliedAt: { $gt: job.lastEmployerView || job.createdAt }
      });
      
      jobObj.hasNewApplications = newApplications.length > 0;
      jobObj.newApplicationsCount = newApplications.length;
      
      // Count filled positions
      const filledPositions = await Application.countDocuments({
        jobId: job._id,
        status: { $in: ['shortlisted', 'accepted'] }
      });
      
      jobObj.filledPositions = filledPositions;
      jobObj.availablePositions = job.openings ? job.openings - filledPositions : 'Unlimited';
      
      // Check if deadline has passed
      let deadlineStatus = null;
      if (job.applicationDeadline) {
        const deadline = new Date(job.applicationDeadline);
        deadline.setHours(23, 59, 59, 999);
        if (deadline < new Date()) {
          deadlineStatus = 'expired';
        }
      }
      
      // Check if openings are filled
      let openingStatus = null;
      if (job.openings && filledPositions >= job.openings) {
        openingStatus = 'filled';
      }
      
      jobObj.deadlineStatus = deadlineStatus;
      jobObj.openingStatus = openingStatus;
      
      return jobObj;
    }));
    
    res.json(jobsWithInfo);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete job (employer only)
app.delete('/api/jobs/:id', authMiddleware, roleMiddleware('employer'), async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify job belongs to employer
    if (job.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete all applications for this job
    await Application.deleteMany({ jobId: job._id });

    // Delete the job
    await Job.findByIdAndDelete(job._id);

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get pending jobs
app.get('/api/admin/jobs/pending', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const jobs = await Job.find({ status: 'pending' })
      .populate('postedBy', 'name email companyName')
      .sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve/reject job
app.put('/api/admin/jobs/:id/review', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    const job = await Job.findById(req.params.id).populate('postedBy');
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    job.status = status;
    if (status === 'rejected') job.rejectionReason = rejectionReason;
    if (status === 'approved') {
      job.approvedAt = new Date();
      job.approvedBy = req.user.id;
    }
    await job.save();

    // Notify employer
    await createNotification(
      job.postedBy._id,
      `Job ${status}`,
      `Your job posting "${job.title}" has been ${status}.`,
      'job',
      `/employer/jobs`
    );

    // Send email
    const emailHtml = `
      <h2>Job Posting ${status.toUpperCase()}</h2>
      <p>Your job posting "<strong>${job.title}</strong>" has been ${status}.</p>
      ${rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
    `;
    await sendEmail(job.postedBy.email, `Job ${status}`, emailHtml);

    res.json({ message: `Job ${status} successfully`, job });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get unverified employers
app.get('/api/admin/employers/unverified', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const employers = await User.find({ role: 'employer', isVerified: false })
      .select('-password -refreshToken')
      .sort({ createdAt: -1 });
    res.json(employers);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify employer
app.put('/api/admin/employers/:id/verify', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'employer') {
      return res.status(404).json({ error: 'Employer not found' });
    }

    user.isVerified = true;
    await user.save();

    // Notify employer
    await createNotification(
      user._id,
      'Account Verified',
      'Your employer account has been verified! You can now post jobs.',
      'system',
      '/employer/dashboard'
    );

    const emailHtml = `
      <h2>Account Verified!</h2>
      <p>Congratulations! Your employer account has been verified.</p>
      <p>You can now start posting jobs on our platform.</p>
    `;
    await sendEmail(user.email, 'Account Verified', emailHtml);

    res.json({ message: 'Employer verified successfully', user });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Platform stats
app.get('/api/admin/stats', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const stats = {
      totalUsers: await User.countDocuments(),
      totalJobs: await Job.countDocuments(),
      pendingJobs: await Job.countDocuments({ status: 'pending' }),
      totalApplications: await Application.countDocuments(),
      unverifiedEmployers: await User.countDocuments({ role: 'employer', isVerified: false })
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// NOTIFICATIONS
// ============================================

// Get user notifications
app.get('/api/notifications', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { read: true },
      { new: true }
    );
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// APPLICATION ROUTES
// ============================================

// Apply to job
app.post('/api/applications', authMiddleware, async (req, res) => {
  try {
    const { jobId, coverLetter } = req.body;
    const user = await User.findById(req.user.id);

    if (user.role !== 'jobseeker') {
      return res.status(403).json({ error: 'Only job seekers can apply to jobs' });
    }

    // Check if job exists and is approved
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.status !== 'approved') {
      return res.status(400).json({ error: 'This job is not available for applications' });
    }

    // Check if already applied
    const existingApplication = await Application.findOne({ jobId, userId: req.user.id });
    if (existingApplication) {
      return res.status(400).json({ error: 'You have already applied for this job' });
    }

    // Check if resume exists
    if (!user.resume) {
      return res.status(400).json({ error: 'Please upload your resume before applying' });
    }

    const application = new Application({
      jobId,
      userId: req.user.id,
      coverLetter: coverLetter || '',
      resumeUsed: user.resume,
      status: 'pending'
    });

    await application.save();

    // Update job applications count
    job.applicationsCount = (job.applicationsCount || 0) + 1;
    await job.save();

    // Notify employer
    await createNotification(
      job.postedBy,
      'New Application',
      `${user.name} applied for your job: ${job.title}`,
      'application',
      `/employer/jobs/${jobId}`
    );

    // Send email to job seeker
    const emailHtml = `
      <h2>Application Submitted Successfully!</h2>
      <p>Hi ${user.name},</p>
      <p>Your application for <strong>${job.title}</strong> at <strong>${job.company}</strong> has been submitted successfully.</p>
      <p>We'll notify you once the employer reviews your application.</p>
      <p>Good luck!</p>
    `;
    await sendEmail(user.email, 'Application Submitted', emailHtml);

    // Send email to employer
    const employer = await User.findById(job.postedBy);
    if (employer) {
      const employerEmailHtml = `
        <h2>New Application Received</h2>
        <p>Hi ${employer.name},</p>
        <p><strong>${user.name}</strong> has applied for your job posting: <strong>${job.title}</strong></p>
        <p>Please review the application in your dashboard.</p>
      `;
      await sendEmail(employer.email, 'New Application Received', employerEmailHtml);
    }

    res.status(201).json({
      message: 'Application submitted successfully',
      application
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Get applications for current user (job seeker)
app.get('/api/applications/my', authMiddleware, async (req, res) => {
  try {
    const applications = await Application.find({ userId: req.user.id })
      .populate({
        path: 'jobId',
        select: 'title company location status',
        populate: { path: 'postedBy', select: 'companyName companyLogo' }
      })
      .sort({ appliedAt: -1 });

    res.json(applications);
  } catch (error) {
    console.error('Applications error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get applications for a job (employer only)
app.get('/api/jobs/:jobId/applications', authMiddleware, roleMiddleware('employer'), async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify job belongs to employer
    if (job.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Count filled positions (shortlisted + accepted applications)
    const filledPositions = await Application.countDocuments({
      jobId: req.params.jobId,
      status: { $in: ['shortlisted', 'accepted'] }
    });

    let applications;
    
    // If all openings are filled, only show selected applications
    if (job.openings && filledPositions >= job.openings) {
      applications = await Application.find({ 
        jobId: req.params.jobId,
        status: { $in: ['shortlisted', 'accepted'] }
      })
        .populate({
          path: 'userId',
          select: 'name email phone location resume skills experience education'
        })
        .sort({ appliedAt: -1 });
    } else {
      // Show all applications while openings are available
      applications = await Application.find({ jobId: req.params.jobId })
        .populate({
          path: 'userId',
          select: 'name email phone location resume skills experience education'
        })
        .sort({ appliedAt: -1 });
    }

    // Update lastEmployerView timestamp
    job.lastEmployerView = new Date();
    await job.save();

    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get job details for applicants (through their applications)
app.get('/api/applications/job/:jobId/details', authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId)
      .populate(
        'postedBy',
        'name email companyName companyLogo companyWebsite isVerified industry companySize companyDescription'
      );

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if user has applied for this job (any status - pending, shortlisted, accepted, rejected)
    const application = await Application.findOne({
      jobId: req.params.jobId,
      userId: req.user.id
    });

    if (!application) {
      return res.status(403).json({ error: 'Access denied. Only applicants can view job details.' });
    }

    // Count filled positions (shortlisted + accepted applications)
    const filledPositions = await Application.countDocuments({
      jobId: job._id,
      status: { $in: ['shortlisted', 'accepted'] }
    });

    const jobObj = job.toObject();
    jobObj.filledPositions = filledPositions;
    jobObj.availablePositions = job.openings ? job.openings - filledPositions : 'Unlimited';
    jobObj.applicationStatus = application.status;
    
    res.json(jobObj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update application status (employer only)
app.put('/api/applications/:id', authMiddleware, roleMiddleware('employer'), async (req, res) => {
  try {
    const { status, employerNotes } = req.body;
    const application = await Application.findById(req.params.id).populate('jobId userId');

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Verify job belongs to employer
    if (application.jobId.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    application.status = status;
    application.statusUpdatedAt = new Date();
    if (employerNotes) application.employerNotes = employerNotes;
    await application.save();

    // Notify job seeker
    await createNotification(
      application.userId._id,
      `Application ${status}`,
      `Your application for "${application.jobId.title}" has been ${status}.`,
      'application',
      '/jobseeker/applications'
    );

    // Send email to job seeker
    const statusMessages = {
      'shortlisted': 'Congratulations! You have been shortlisted for this position.',
      'accepted': 'Congratulations! Your application has been accepted!',
      'rejected': 'We regret to inform you that your application was not selected for this position.'
    };

    const emailHtml = `
      <h2>Application Status Update</h2>
      <p>Hi ${application.userId.name},</p>
      <p>Your application for <strong>${application.jobId.title}</strong> at <strong>${application.jobId.company}</strong> has been <strong>${status}</strong>.</p>
      <p>${statusMessages[status] || ''}</p>
      ${employerNotes ? `<p><strong>Notes from employer:</strong> ${employerNotes}</p>` : ''}
      <p>Check your dashboard for more details.</p>
    `;
    await sendEmail(application.userId.email, `Application ${status}`, emailHtml);

    res.json({ message: 'Application status updated successfully', application });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ADMIN ENHANCED ROUTES
// ============================================

// Get all users
app.get('/api/admin/users', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { role, search } = req.query;
    const query = {};

    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { companyName: new RegExp(search, 'i') }
      ];
    }

    const users = await User.find(query)
      .select('-password -refreshToken')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile by ID (for employers to view job seeker profiles)
app.get('/api/users/:id/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -refreshToken -isBlocked');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only allow employers and admins to view job seeker profiles
    const currentUser = await User.findById(req.user.id);
    if (user.role === 'jobseeker' && currentUser.role !== 'employer' && currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    user.profileCompletion = calculateProfileCompletion(user);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve resume file securely (only owner, employer or admin can access)
app.get('/api/resume/:userId', async (req, res) => {
  try {
    // Try to get token from Authorization header or query param
    let token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token && req.query && req.query.token) token = req.query.token;

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const requester = await User.findById(decoded.id);
    const target = await User.findById(req.params.userId);
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Allow if requester is the owner, an employer, or admin
    if (requester._id.toString() !== target._id.toString() &&
      requester.role !== 'employer' &&
      requester.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!target.resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    // Build safe path to resume file (remove leading slash)
    
    const resumeRel = target.resume.replace(/^\/+/, '');
    const resumePath = path.join(__dirname, resumeRel);

    console.log("Resume file path:", resumePath);

    if (!fs.existsSync(resumePath)) {
      return res.status(404).json({ error: 'Resume file missing on server' });
    }

    // Set headers to display inline in browser
    res.sendFile(resumePath, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${path.basename(resumePath)}"`,
        'Cache-Control': 'no-store',
        'Content-Length': fs.statSync(resumePath).size
      }
    });

  } catch (error) {
    console.error('Resume serve error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Block/Unblock user
app.put('/api/admin/users/:id/block', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { blocked } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot block admin users' });
    }

    user.isBlocked = blocked;
    await user.save();

    await createNotification(
      user._id,
      blocked ? 'Account Blocked' : 'Account Unblocked',
      blocked
        ? 'Your account has been blocked by an administrator. Please contact support.'
        : 'Your account has been unblocked. You can now use the platform.',
      'system',
      '/'
    );

    res.json({ message: `User ${blocked ? 'blocked' : 'unblocked'} successfully`, user });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user
app.delete('/api/admin/users/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin users' });
    }

    // Delete user's jobs
    await Job.deleteMany({ postedBy: user._id });

    // Delete user's applications
    await Application.deleteMany({ userId: user._id });

    // Delete user's notifications
    await Notification.deleteMany({ userId: user._id });

    await User.findByIdAndDelete(user._id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Enhanced platform stats
app.get('/api/admin/stats', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const stats = {
      totalUsers: await User.countDocuments(),
      totalJobSeekers: await User.countDocuments({ role: 'jobseeker' }),
      totalEmployers: await User.countDocuments({ role: 'employer' }),
      verifiedEmployers: await User.countDocuments({ role: 'employer', isVerified: true }),
      unverifiedEmployers: await User.countDocuments({ role: 'employer', isVerified: false }),
      blockedUsers: await User.countDocuments({ isBlocked: true }),
      totalJobs: await Job.countDocuments(),
      approvedJobs: await Job.countDocuments({ status: 'approved' }),
      pendingJobs: await Job.countDocuments({ status: 'pending' }),
      rejectedJobs: await Job.countDocuments({ status: 'rejected' }),
      totalApplications: await Application.countDocuments(),
      pendingApplications: await Application.countDocuments({ status: 'pending' }),
      shortlistedApplications: await Application.countDocuments({ status: 'shortlisted' }),
      acceptedApplications: await Application.countDocuments({ status: 'accepted' })
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// FAKE JOB REPORTING
// ============================================

// Report Schema for fake jobs
const reportSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['pending', 'reviewed', 'resolved', 'dismissed'], default: 'pending' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date }
});

const Report = mongoose.model('Report', reportSchema);

// Report a job
app.post('/api/jobs/:id/report', authMiddleware, async (req, res) => {
  try {
    const { reason, description } = req.body;
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if already reported by this user
    const existingReport = await Report.findOne({
      jobId: req.params.id,
      reportedBy: req.user.id
    });
    if (existingReport) {
      return res.status(400).json({ error: 'You have already reported this job' });
    }

    const report = new Report({
      jobId: req.params.id,
      reportedBy: req.user.id,
      reason,
      description: description || ''
    });

    await report.save();

    // Notify admins
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await createNotification(
        admin._id,
        'Job Reported',
        `A job "${job.title}" has been reported for: ${reason}`,
        'system',
        `/admin/reports/${report._id}`
      );
    }

    res.status(201).json({ message: 'Job reported successfully. Our team will review it.', report });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get reports (admin only)
app.get('/api/admin/reports', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const reports = await Report.find({ status: 'pending' })
      .populate('jobId', 'title company')
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Review report (admin only)
app.put('/api/admin/reports/:id/review', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { status, action } = req.body; // action: 'block_job', 'block_employer', 'dismiss'
    const report = await Report.findById(req.params.id).populate('jobId');

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    report.status = status;
    report.reviewedBy = req.user.id;
    report.reviewedAt = new Date();
    await report.save();

    if (action === 'block_job') {
      const job = await Job.findById(report.jobId._id);
      job.status = 'rejected';
      job.rejectionReason = 'Reported as fake/inappropriate';
      await job.save();
    } else if (action === 'block_employer') {
      const employer = await User.findById(report.jobId.postedBy);
      employer.isBlocked = true;
      await employer.save();
    }

    res.json({ message: 'Report reviewed successfully', report });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Email configured: ${!!process.env.EMAIL_USER}`);
});

// ============================================
// EMPLOYER HELPERS
// ============================================

// Employer requests admin verification after completing profile
app.post('/api/employer/request-verification', authMiddleware, roleMiddleware('employer'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const completion = calculateProfileCompletion(user);
    if (completion < 100) {
      return res.status(400).json({ error: 'Please complete your profile (100%) before requesting verification', profileCompletion: completion });
    }

    if (user.isVerified) {
      return res.json({ message: 'Your account is already verified' });
    }

    // Notify all admins
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await createNotification(
        admin._id,
        'Employer Verification Requested',
        `${user.companyName || user.name} has requested account verification.`,
        'system',
        `/admin/employers/unverified`
      );
      // Optionally send email to admin if configured
      if (process.env.EMAIL_USER) {
        await sendEmail(admin.email, 'Employer Verification Requested', `<p>${user.name} (${user.email}) has requested verification.</p>`);
      }
    }

    res.json({ message: 'Verification request sent to admins. You will be notified once verified.' });
  } catch (error) {
    console.error('Verification request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
