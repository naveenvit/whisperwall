require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');

const Whisper = require('./models/Whisper');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middlewares =====
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5kb' })); // short messages
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// ===== MongoDB connection =====
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/whisperwall';
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Atlas connected"))
.catch(err => console.error("❌ DB connection error:", err));


// ===== Rate limiter for posting (simple) =====
const postLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 1, // allow 1 post per window per IP
  message: { error: 'Too many posts from this IP. Try again later.' }
});

// ===== Routes =====

// POST /api/whispers  -> create new anonymous whisper
app.post('/api/whispers', postLimiter, async (req, res) => {
  try {
    const { message, lat, lng } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > 280) {
      return res.status(400).json({ error: 'Message too long (max 280 chars)' });
    }
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Valid lat and lng required' });
    }

    const w = new Whisper({
      message: message.trim(),
      location: { type: 'Point', coordinates: [longitude, latitude] }
    });

    await w.save();
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/whispers?lat=..&lng=..&radius=meters
app.get('/api/whispers', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = req.query.radius ? parseFloat(req.query.radius) : 5000; // default 5km

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng query parameters required' });
    }

    const results = await Whisper.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radius
        }
      }
    }).sort({ createdAt: -1 }).limit(200);

    // convert to client-friendly format
    const resData = results.map(r => ({
      id: r._id,
      message: r.message,
      lat: r.location.coordinates[1],
      lng: r.location.coordinates[0],
      createdAt: r.createdAt
    }));

    res.json(resData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fallback
app.use((req, res) => {
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
