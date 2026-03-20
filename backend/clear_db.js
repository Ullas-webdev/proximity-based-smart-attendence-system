require('dotenv').config();
const mongoose = require('mongoose');

const User = require('./models/User');
const Class = require('./models/Class');
const Attendance = require('./models/Attendance');
const ProximityBuffer = require('./models/ProximityBuffer');

async function clearDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected');

    console.log('🗑️ Clearing collections...');
    
    const userResult = await User.deleteMany({});
    console.log(`- Deleted ${userResult.deletedCount} users`);

    const classResult = await Class.deleteMany({});
    console.log(`- Deleted ${classResult.deletedCount} classes`);

    const attendanceResult = await Attendance.deleteMany({});
    console.log(`- Deleted ${attendanceResult.deletedCount} attendance records`);

    const proximityResult = await ProximityBuffer.deleteMany({});
    console.log(`- Deleted ${proximityResult.deletedCount} proximity buffer records`);

    console.log('\n✨ Database cleared successfully! You can now start fresh.');
    
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error clearing database:', err.message);
    process.exit(1);
  }
}

clearDatabase();
