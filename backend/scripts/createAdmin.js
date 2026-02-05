require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function run() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/job-portal';
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    // Use a flexible model so we don't need to import the app
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    const email = 'admin@example.test';
    const existing = await User.findOne({ email });
    if (existing) {
      console.log('Admin already exists:', existing.email);
      process.exit(0);
    }

    const hashed = await bcrypt.hash('AdminPass123!', 10);

    const admin = new User({
      name: 'Admin User',
      email,
      password: hashed,
      role: 'admin',
      isVerified: true,
      createdAt: new Date()
    });

    await admin.save();
    console.log('Created admin:', email);
    console.log('Password: AdminPass123!');
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err.message);
    process.exit(1);
  }
}

run();
