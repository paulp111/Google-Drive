const express = require('express');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const app = express();
const prisma = new PrismaClient();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(__dirname));
app.use(express.urlencoded({ extended: true }));

// Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Render frontend
app.get('/', async (req, res) => {
  const files = await prisma.file.findMany();
  res.render('index', { files });
});

// File upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  const { file } = req;
  if (!file) {
    return res.status(400).send('No file uploaded.');
  }

  // Save file details in database
  await prisma.file.create({
    data: {
      filename: file.originalname,
      mimetype: file.mimetype,
      path: file.path
    }
  });

  res.redirect('/');
});

// File rename endpoint
app.post('/rename/:id', async (req, res) => {
  const { id } = req.params;
  const { newName } = req.body;

  // Finde die Datei in der Datenbank
  const file = await prisma.file.findUnique({
    where: { id: parseInt(id) }
  });

  if (!file) {
    return res.status(404).send('File not found.');
  }

  // Extrahiere die Dateiendung
  const fileExtension = path.extname(file.filename);
  const newFilename = newName + fileExtension;
  const newPath = 'uploads/' + newFilename;

  // Benenne die Datei im Dateisystem um
  fs.rename(file.path, newPath, async (err) => {
    if (err) {
      return res.status(500).send('Error renaming the file.');
    }

    // Aktualisiere den Dateinamen und den Pfad in der Datenbank
    await prisma.file.update({
      where: { id: parseInt(id) },
      data: { filename: newFilename, path: newPath }
    });

    res.redirect('/');
  });
});

// File delete endpoint
app.post('/delete/:id', async (req, res) => {
  const { id } = req.params;

  const file = await prisma.file.findUnique({
    where: { id: parseInt(id) }
  });

  if (!file) {
    return res.status(404).send('File not found.');
  }

  // Delete file from filesystem
  fs.unlink(file.path, async (err) => {
    if (err) {
      return res.status(500).send('Error deleting the file.');
    }

    // Delete file from database
    await prisma.file.delete({
      where: { id: parseInt(id) }
    });

    res.redirect('/');
  });
});

// File download endpoint
app.get('/download/:id', async (req, res) => {
  const { id } = req.params;

  const file = await prisma.file.findUnique({
    where: { id: parseInt(id) }
  });

  if (!file) {
    return res.status(404).send('File not found.');
  }

  // Send file to the user for download
  res.download(file.path, file.filename);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
