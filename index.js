import express from 'express';
import cors from 'cors';
import config from './config/config.js';

// Import routes
import transcriptRoutes from './routes/transcript.js';
import chaptersRoutes from './routes/chapters.js';
import combinedRoutes from './routes/combined.js';
import aiRoutes from './routes/ai.js';
import transcribeRoutes from './routes/transcribe.js';
import downloadRoutes from './routes/download.js';

const app = express();
const PORT = config.port;

// Middleware
app.use(cors());
app.use(express.json());

// Use routes
app.use('/api', transcriptRoutes);
app.use('/api', chaptersRoutes);
app.use('/api', combinedRoutes);
app.use('/api', aiRoutes);
app.use('/api', transcribeRoutes);
app.use('/api', downloadRoutes);

// Simple home route
app.get('/', (req, res) => {
  res.send(`
    <h1>YouTube Transcript API</h1>
    <p>Send a POST request to /api/transcript with a YouTube URL in the request body to get the transcript.</p>
    <p>Example:</p>
    <pre>
      POST /api/transcript
      Content-Type: application/json
      
      {
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      }
    </pre>
  `);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 