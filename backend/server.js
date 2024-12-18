const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const app = express();
const dbModule = require("./db");
const pdfParse = require('pdf-parse');
const OpenAI  =  require('openai');
require('dotenv').config();


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'uploads')); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }
    res.send(`File uploaded: <a href="/uploads/${req.file.filename}">View File</a>`);
});

const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
});
  
  

  
const checkTextWithAI = async (text) => {
    const maxRetries = 5;
    let retries = 0;

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    while (retries < maxRetries) {
        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an AI detection assistant. Given a piece of text, provide a single numerical response between 0 and 100 indicating the likelihood that the text was generated by an AI. Do not provide additional comments or explanations.',
                    },
                    { role: 'user', content: text },
                ],
            });

            const probability = parseFloat(response.choices[0].message.content.trim());
            if (isNaN(probability) || probability < 0 || probability > 100) {
                throw new Error('Invalid response from AI');
            }
            return probability;
        } catch (error) {
            if (error.response && error.response.status === 429) {
                retries++;
                const backoffTime = Math.pow(2, retries) * 1000; 
                console.log(`Rate limit exceeded. Retrying in ${backoffTime / 1000} seconds...`);
                await delay(backoffTime);
            } else {
                console.error('Error details:', error); 
                throw new Error('Error connecting to OpenAI API: ' + error.message);
            }
        }
    }

    throw new Error('Exceeded maximum retry attempts');
};




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
        res.render('main', { user: req.session.user });  
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





app.get('/tasks/:taskId', (req, res) => {
    const taskId = req.params.taskId;

    if (req.session.user) {
        dbModule.getTaskById(taskId, (err, task) => {
            if (err) {
                console.error("Error fetching task:", err);
                res.status(500).json({ message: "Internal server error" });
                return;
            }

            if (!task) {
                res.status(404).json({ message: "Task not found" });
                return;
            }
            dbModule.getCourseByTaskId(taskId, (err, course) => {
                if (err) {
                    console.error("Error fetching course:", err);
                    res.status(500).json({ message: "Internal server error" });
                    return;
                }

                if (!course) {
                    res.status(404).json({ message: "Course not found" });
                    return;
                
                }
                console.log("pushing task");
                console.log(task);
                res.render('task', { task, course, user: req.session.user });
            });
        });
    } else {
        res.redirect('/login');
    }
});



app.get('/courses/:courseId', (req, res) => {
    const courseId = req.params.courseId;

    if (req.session.user) {
        dbModule.getCourseById(courseId, (err, course) => {
            if (err) {
                console.error("Error fetching course:", err);
                res.status(500).json({ message: "Internal server error" });
                return;
            }

            if (!course) {
                res.status(404).json({ message: "Course not found" });
                return;
            }

            dbModule.getTasksByCourseId(courseId, (err, tasks) => {
                if (err) {
                    console.error("Error fetching tasks:", err);
                    res.status(500).json({ message: "Internal server error" });
                    return;
                }

                course.tasks = tasks;
                res.render('courses', { course, user: req.session.user });
            });
        });
    } else {
        res.redirect('/login');
    }
});





app.post('/login', (req, res) => {
    const { email, password } = req.body;

    dbModule.validateLogin(email, password, (err, user) => {
        if (err) {
            console.error("Error during login:", err);
            res.status(500).json({ message: "Internal server error" });
            return;
        }

        if (user) {
            dbModule.getCoursesForUser(user.id, (err, courses) => {
                if (err) {
                    console.error("Error fetching courses:", err);
                    res.status(500).json({ message: "Internal server error" });
                    return;
                }

                console.log(courses)

                req.session.user = {
                    id: user.id,
                    email: user.email,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    courses: courses,
                    status: user.student_status, 
                };

                res.json({ message: "Login successful", user: req.session.user });
            });
        } else {
            res.status(401).json({ message: "Invalid credentials" });
        }
    });
});




app.post('/register', (req, res) => {
    const { email, password, firstname, lastname, student_status } = req.body;

    dbModule.userExists(email, (err, exists) => {
        if (err) {
            console.error("Error checking user existence:", err);
            res.status(500).json({ message: "Internal server error" });
            return;
        }

        if (exists) {
            res.status(400).json({ message: "User already exists" });
        } else {
            dbModule.addUser(email, password, firstname, lastname, student_status, (err, userId) => {
                if (err) {
                    console.error("Error adding user:", err);
                    res.status(500).json({ message: "Internal server error" });
                    return;
                }

                dbModule.getCoursesForUser(userId, (err, courses) => {
                    if (err) {
                        console.error("Error fetching courses:", err);
                        res.status(500).json({ message: "Internal server error" });
                        return;
                    }

                    req.session.user = {
                        id: userId,
                        email,
                        firstname,
                        lastname,
                        courses,
                        status: student_status, 
                    };
                    console.log(userId);

                    res.json({ message: "Registration successful", user: req.session.user });
                });
            });
        }
    });
});





app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.post('/submit-task', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const { userId, taskId } = req.body;
    const filePath = `/uploads/${req.file.filename}`;
    const submissionDate = new Date().toLocaleString();
    let plagiarismPercentage = -1;

    console.log(req.file.mimetype);

    try {
        let text = '';
        if (req.file.mimetype === 'application/pdf') {
            const data = await pdfParse(fs.readFileSync(req.file.path));
            text = data.text;
        } else if (req.file.mimetype === 'text/plain') {
            console.log("Processing a plain text file");
            text = fs.readFileSync(req.file.path, 'utf8');
        } else {
            return res.status(400).json({ message: 'Unsupported file type' });
        }

        console.log("Sending text to AI model for analysis");
        plagiarismPercentage = await checkTextWithAI(text);

        dbModule.addSubmittedTask(userId, taskId, filePath, (err, taskId) => {
            if (err) {
                return res.status(500).json({ message: `Error saving task submission: ${err}` });
            }

            dbModule.updateTaskSubmissionStatus(taskId, 1, submissionDate, (err) => {
                if (err) {
                    return res.status(500).json({ message: `Error updating task submission status: ${err}` });
                }

                res.json({
                    plagiarismPercentage,
                    submissionDate,
                    filePath,
                });
            });
        });
    } catch (error) {
        console.error('Error processing file:', error.message);
        res.status(500).json({ message: 'Error analyzing file' });
    }
});






app.get('/get-students-in-course/:courseId', (req, res) => {
    const courseId = req.params.courseId;

   dbModule.getStudentsInCourse(courseId, (err, students) => {
        if (err) {
            return res.status(500).json({ message: `Error fetching students: ${err.message}` });
        }

        res.json({ students: students });
    });
});

app.post('/update-grade', (req, res) => {
    const { userId, courseId, taskId, grade } = req.body;

    dbModule.updateGrade(userId, courseId, taskId, grade, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }

        res.json(result);
    });
});




app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    dbModule.initTables();

    dbModule.addCourse("Українська мова", "Викладач", "/uploads/a.jpg", (err, courseId) => {
        if (err) {
            console.error("Failed to add course:", err);
        } else {
            console.log(`Course added with ID: ${courseId}`);
        }
    });
    
    dbModule.addCourseToUser(1, 1, (err, joinId) => {
        if (err) {
            console.error("Failed to add course to user:", err);
        } else {
            console.log(`User-course mapping added with ID: ${joinId}`);
        }
    });

    dbModule.addTask(1,"Написати доповідь про літо",-1,-1,(err,taskId) => {
        if (err) {
            console.error("Failed to add course:", err);
        } else {
            console.log(`Course added with ID: ${taskId}`);
        }
    })
});
