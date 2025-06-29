const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');
const app = express();
const PORT = 5000;

app.use(cors());

// Verify FFmpeg installation
try {
  ffmpeg.getAvailableFormats((err) => {
    if (err) throw new Error('FFmpeg not found. Please install FFmpeg and add it to your PATH.');
    console.log('FFmpeg is available');
  });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const rtspUrl = 'rtsp://admin:@192.168.8.100:88/videoMain';

app.get('/stream', (req, res) => {
  console.log('New client connected to stream');

res.writeHead(200, {
  'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*' ,
  'X-Accel-Buffering': 'no'// Important for React dev server
});

  // Create the FFmpeg command
  const command = ffmpeg()
    .input(rtspUrl)
    .inputOptions([
      '-rtsp_transport tcp',
      '-timeout 5000000',
        '-re',
      '-fflags nobuffer',
      '-flags low_delay' // Use -timeout instead of -stimeout for compatibility
    ])
    .outputOptions([
      '-f mjpeg',
      '-q:v 5',
      '-r 15',
      '-update 1',
      
    ])
    .videoCodec('mjpeg')
    .size('640x480')
    .on('start', (commandLine) => {
      console.log('FFmpeg command:', commandLine);
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err.message);
      if (!res.headersSent) {
        res.status(500).end('Stream error');
      }
      // No need to call res.end() here as the pipe will handle it
    })
    .on('end', () => {
      console.log('FFmpeg stream ended normally');
    });

  // Pipe the output to response
  const stream = command.pipe(res, { end: true });

  // Handle client disconnection
  req.on('close', () => {
    console.log('Client disconnected - cleaning up');
    try {
      // Proper way to stop FFmpeg
      command.kill('SIGKILL');
      stream.destroy();
    } catch (err) {
      console.error('Error during cleanup:', err.message);
    }
  });
});


app.listen(PORT, () => {
  console.log(`Stream server running at http://localhost:${PORT}/stream`);
});