const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://jobuser:jobportal123@cluster0.iatff3a.mongodb.net/?appName=Cluster0';

const userSchema = new mongoose.Schema({
    name: String,
    resume: String,
    role: String
});

const User = mongoose.model('User', userSchema);

async function checkUser(userId) {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const user = await User.findById(userId);
        if (!user) {
            console.log('User not found');
        } else {
            console.log(`User: ${user.name}`);
            console.log(`Role: ${user.role}`);
            console.log(`Resume Path in DB: ${user.resume}`);
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

const id = process.argv[2] || '6970b5987eb6c175bc604f01';
checkUser(id);
