const express = require('express');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const session = require('express-session');
const prisma = new PrismaClient();

const app = express();

// Session configuration
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Middleware to check if the user is logged in
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    res.redirect('/login');
  } else {
    next();
  }
}

// Route to render home page
app.get('/', async (req, res) => {
  if (!req.session.userId) {
    res.render('index', { files: [], message: 'You are not logged in. Please log in to upload or view files.', session: req.session });
  } else {
    const files = await prisma.file.findMany({
      where: { userId: req.session.userId }
    });
    res.render('index', { files, message: null, session: req.session });
  }
});


// Route to handle file uploads
app.post('/upload', requireLogin, upload.single('file'), async (req, res) => {
  const { file } = req;
  const userId = req.session.userId;

  if (!file) {
    return res.status(400).send('No file uploaded.');
  }

  await prisma.file.create({
    data: {
      filename: file.originalname,
      mimetype: file.mimetype,
      path: file.path,
      userId: userId
    }
  });

  res.redirect('/');
});

// Route to handle file renaming
app.post('/rename/:id', requireLogin, async (req, res) => {
  const fileId = parseInt(req.params.id);
  const userId = req.session.userId;
  const { newName } = req.body;

  const file = await prisma.file.findUnique({
    where: { id: fileId }
  });

  if (!file || file.userId !== userId) {
    return res.status(403).send('You are not authorized to rename this file.');
  }

  const fileExtension = file.filename.split('.').pop();
  const updatedFilename = `${newName}.${fileExtension}`;

  await prisma.file.update({
    where: { id: fileId },
    data: {
      filename: updatedFilename
    }
  });

  res.redirect('/');
});

// Route to handle file deletion
app.post('/delete/:id', requireLogin, async (req, res) => {
  const fileId = parseInt(req.params.id);
  const userId = req.session.userId;

  const file = await prisma.file.findUnique({
    where: { id: fileId }
  });

  if (!file || file.userId !== userId) {
    return res.status(403).send('You are not authorized to delete this file.');
  }

  await prisma.file.delete({
    where: { id: fileId }
  });

  res.redirect('/');
});

// Route to download files
app.get('/download/:id', requireLogin, async (req, res) => {
  const fileId = parseInt(req.params.id);
  const userId = req.session.userId;

  const file = await prisma.file.findUnique({
    where: { id: fileId }
  });

  if (!file || file.userId !== userId) {
    return res.status(403).send('You are not authorized to download this file.');
  }

  res.download(file.path, file.filename);
});

// Login route
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user || user.password !== password) {
    return res.status(400).send('Invalid credentials.');
  }

  req.session.userId = user.id;
  res.redirect('/');
});

// Sign-up route
app.get('/sign-up', (req, res) => {
  res.render('sign-up');
});

app.post('/sign-up', async (req, res) => {
  const { email, password } = req.body;

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    return res.status(400).send('User with this email already exists.');
  }

  const user = await prisma.user.create({
    data: {
      email,
      password
    }
  });

  req.session.userId = user.id;
  res.redirect('/');
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
