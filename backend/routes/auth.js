const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Class = require('../models/Class');
const { protect } = require('../middleware/auth');


// Generate JWT
const signToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};




/* =====================================================
   REGISTER
===================================================== */

router.post('/register', async (req, res) => {
  try {

    const {
      name,
      email,
      password,
      role,
      rollNumber,
      department,
      semester,
      bluetoothDeviceId
    } = req.body;


    // Check if email exists
    const existing = await User.findOne({ email });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }


    // Build user object
    const userData = {
      name,
      email,
      password,
      role,
      department,
      semester
    };

    if (rollNumber) userData.rollNumber = rollNumber;
    if (bluetoothDeviceId) userData.bluetoothDeviceId = bluetoothDeviceId;


    // Create user
    const user = await User.create(userData);



    /* --------------------------------
       AUTO ENROLL STUDENT TO CLASSES
    -------------------------------- */

    if (user.role === 'student') {

      const classes = await Class.find();

      if (classes.length > 0) {

        const classIds = classes.map(c => c._id);

        // add classes to user
        await User.findByIdAndUpdate(
          user._id,
          {
            $addToSet: {
              enrolledClasses: { $each: classIds }
            }
          }
        );

        // add student to classes
        await Class.updateMany(
          { _id: { $in: classIds } },
          { $addToSet: { students: user._id } }
        );

      }

    }


    /* --------------------------------
       AUTO CREATE CLASSES FOR TEACHERS
    -------------------------------- */

    if (user.role === 'teacher') {

      const { demoClasses } = require('../utils/demoClasses');

      for (const sub of demoClasses) {

        const cls = await Class.create({
          name: sub.name,
          subject: sub.subject,
          subjectCode: sub.subjectCode,
          teacher: user._id,
          department: sub.department || user.department,
          semester: sub.semester,
          esp32DeviceId: sub.esp32DeviceId,
          attendanceActive: false,
          students: [],
          totalClassesHeld: 0,
          schedule: [
            { day: 'Monday', startTime: '09:00', endTime: '10:00' }
          ]
        });

        // Add class to teacher
        await User.findByIdAndUpdate(
          user._id,
          { $addToSet: { teachingClasses: cls._id } }
        );

        // Auto-enroll matching students
        const matchingStudents = await User.find({
          role: 'student',
          department: cls.department,
          semester: cls.semester
        });

        if (matchingStudents.length > 0) {
          const studentIds = matchingStudents.map(s => s._id);
          cls.students = studentIds;
          await cls.save();

          await User.updateMany(
            { _id: { $in: studentIds } },
            { $addToSet: { enrolledClasses: cls._id } }
          );
        }

      }

    }


    const token = signToken(user._id);


    res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNumber: user.rollNumber,
        department: user.department,
        semester: user.semester,
        bluetoothDeviceId: user.bluetoothDeviceId
      }
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message
    });

  }
});




/* =====================================================
   LOGIN
===================================================== */

router.post('/login', async (req, res) => {
  try {

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password required'
      });
    }


    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }


    const token = signToken(user._id);


    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNumber: user.rollNumber,
        department: user.department,
        semester: user.semester,
        bluetoothDeviceId: user.bluetoothDeviceId,
        enrolledClasses: user.enrolledClasses,
        teachingClasses: user.teachingClasses
      }
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message
    });

  }
});




/* =====================================================
   GET CURRENT USER
===================================================== */

router.get('/me', protect, async (req, res) => {

  const user = await User.findById(req.user._id)
    .populate('enrolledClasses', 'name subject subjectCode')
    .populate('teachingClasses', 'name subject subjectCode students');

  res.json({
    success: true,
    user
  });

});




/* =====================================================
   UPDATE BLUETOOTH DEVICE
===================================================== */

router.put('/update-bluetooth', protect, async (req, res) => {
  try {

    const { bluetoothDeviceId } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { bluetoothDeviceId },
      { new: true }
    );

    res.json({
      success: true,
      bluetoothDeviceId: user.bluetoothDeviceId
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message
    });

  }
});


module.exports = router;