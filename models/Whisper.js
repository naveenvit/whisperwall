const mongoose = require('mongoose');

const WhisperSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 280 // short message
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// 2dsphere for geo queries
WhisperSchema.index({ location: '2dsphere' });

// TTL index: expire documents 24 hours (86400 seconds) after createdAt
WhisperSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('Whisper', WhisperSchema);
