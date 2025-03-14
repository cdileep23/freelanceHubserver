const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// Generate JWT
const generateToken = (userId,userType) => {
  return jwt.sign({ userId,userType }, process.env.JWT_SECRET, { expiresIn: '3d' });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fullName, userType, skills, bio } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      email,
      password,
      fullName,
      userType,
      skills: skills || [],
      bio: bio || ''
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        userType: user.userType
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password, userType } = req.body;

    // Check for missing fields
    if (!email || !password || !userType) {
      return res.status(400).json({ message: 'Email, password, and userType are required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Role check
    if (!user.userType || user.userType.toLowerCase() !== userType.toLowerCase()) {
      return res.status(403).json({ sucess:false, message: 'User role not matched' });
    }

    const token = generateToken(user._id, user.userType);

    res.cookie("token", token, {
      expires: new Date(Date.now() + 8 * 3600000),
    });

    res.json({
      _id: user._id,
      email: user.email,
      fullName: user.fullName,
      userType: user.userType
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



exports.getCurrentUser = async (req, res) => {
  try {
   
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,

    sameSite: 'Strict'
  });

  res.status(200).json({ message: 'Logged out successfully' });
};
exports.checkToken = (req, res) => {
  try {
    // Extract token from cookies
    const token = req.cookies?.token;

    // Check if token exists
    if (!token) {
      return res.status(403).json({
        message: "No token provided",
        success: false,
      });
    }

    // Verify token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({
          message: "Invalid or expired token",
          success: false,
        });
      }

      // Token is valid, return success response with user details
      res.status(200).json({
        message: "Token is valid",
        success: true,
        userId: decoded.userId,
        userType: decoded.userType, // Optional if you need role-based logic
      });
    });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(500).json({
      message: "Internal server error",
      success: false,
    });
  }
};


exports.updateProfile = async (req, res) => {
  const  userId  = req.user._id; // Assuming userId is passed in params
  const { fullName, skills, bio, profileImage } = req.body;

  try {
    // Check if user exists
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields if provided
    if (fullName) user.fullName = fullName;
    if (skills && Array.isArray(skills)) user.skills = skills;
    if (bio) user.bio = bio;
    if (profileImage) user.profileImage = profileImage;

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        userType: user.userType,
        skills: user.skills,
        bio: user.bio,
        profileImage: user.profileImage,
        moneyEarned: user.moneyEarned,
        moneySpent: user.moneySpent,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Profile Update Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
