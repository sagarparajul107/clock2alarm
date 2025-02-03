const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware
app.use(express.static('.'));
app.use(express.json());
app.use(fileUpload({
  createParentPath: true,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  },
}));

// Serve static files with proper MIME types
app.use('/sounds', express.static('sounds', {
  setHeaders: (res, path) => {
    if (path.endsWith('.mp3')) {
      res.set('Content-Type', 'audio/mpeg');
    } else if (path.endsWith('.wav')) {
      res.set('Content-Type', 'audio/wav');
    }
  }
}));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'sounds', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Get list of uploaded sounds
app.get('/list-sounds', (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const sounds = files.map(file => {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);
      return {
        id: file,
        name: file.replace(/\.[^/.]+$/, ""), // Remove extension
        path: `/sounds/uploads/${file}`,
        size: stats.size,
        uploadDate: stats.mtime
      };
    });
    res.json(sounds);
  } catch (error) {
    console.error('Error listing sounds:', error);
    res.status(500).json({ error: 'Failed to list sounds' });
  }
});

// Upload sound file
app.post('/upload-sound', (req, res) => {
  try {
    if (!req.files || !req.files.sound) {
      return res.status(400).json({ error: 'No sound file uploaded' });
    }

    const soundFile = req.files.sound;
    
    // Check if it's an audio file by MIME type
    if (!soundFile.mimetype.startsWith('audio/')) {
      return res.status(400).json({ error: 'Please upload an audio file' });
    }

    const timestamp = Date.now();
    const safeName = `${timestamp}-${soundFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const uploadPath = path.join(uploadsDir, safeName);

    soundFile.mv(uploadPath, (err) => {
      if (err) {
        console.error('Error saving file:', err);
        return res.status(500).json({ error: 'Failed to save file' });
      }

      res.json({
        id: safeName,
        name: soundFile.name.replace(/\.[^/.]+$/, ""),
        path: `/sounds/uploads/${safeName}`,
        size: soundFile.size,
        uploadDate: new Date()
      });
    });
  } catch (error) {
    console.error('Error handling upload:', error);
    res.status(500).json({ error: 'Failed to upload sound' });
  }
});

// Delete sound file
app.post('/delete-sound', (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'No sound ID provided' });
    }

    const filePath = path.join(uploadsDir, id);
    
    // Validate the file path is within uploads directory
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(403).json({ error: 'Invalid file path' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Sound file not found' });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting sound:', error);
    res.status(500).json({ error: 'Failed to delete sound' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
