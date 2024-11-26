const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const app = express();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); 
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); 
    }
});
const upload = multer({ storage });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, '..') + '/frontend/public/views'); 


app.use(express.static(path.resolve(__dirname, '..') + '/frontend/public'));  

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
}));


app.use(cors());

const PORT = process.env.PORT || 3000;


app.get('/', (req, res) => {
    if (req.session.user) {
        res.render('main');  
    } else {
        res.redirect('/login');  
    }
});


app.get('/login', (req, res) => {
    if (req.session.user) {
        res.redirect('/');
    } else {
        res.render('login');
    }
});


app.get('/register', (req, res) => {
    res.render('register');  
});


app.get('/main', (req, res) => {
    if (req.session.user) {
        res.render('main');
    } else {
        res.redirect('/login');
    }
});


app.get('/tasks/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    if (req.session.user) {
        // TODO: Replace with database logic to fetch task
        const task = { id: taskId, title: `Task ${taskId}`, status: 'Not Completed' };
        res.render('task', { task });
    } else {
        res.redirect('/login');
    }
});

app.get('/courses/:courseName', (req, res) => {
    const courseName = req.params.courseName;
    if (req.session.user) {
        // TODO: Replace with database logic to fetch course data
        const course = { name: courseName, description: `Details about ${courseName}` };
        res.render('courses', { course });
    } else {
        res.redirect('/login');
    }
});

// Login POST route (authenticate user)
//gfdgfdgfd
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // TODO: Add database verification for user login
    if (email === 'user@m.ua' && password === 'password') {
        console.log('Working')
        req.session.user = { email };  
        res.redirect('/');
    } else {
        res.status(401).json({message:'Invalid credentials'}); 
    }
});


app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.post('/submit-task', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const { userId, courseId, taskId } = req.body;
    const filePath = `/uploads/${req.file.filename}`;
    const grade = "A";
    const plagiarismPercentage = 10;
    const submissionDate = new Date().toLocaleString();


    res.json({
        grade,
        plagiarismPercentage,
        submissionDate,
        filePath,
    });
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
