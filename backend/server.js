const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const app = express();
const dbModule = require("./db");
const pdfParse = require('pdf-parse');
const { Configuration, OpenAIApi } = require('openai');
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

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }
    res.send(`File uploaded: <a href="/uploads/${req.file.filename}">View File</a>`);
});

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);
  
  
  const readTextFromFile = (filePath) => {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return reject(err);
        resolve(data);
      });
    });
  };
  
  
  const checkTextWithAI = async (text) => {
    try {
      const response = await openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Determine if the following text is AI-generated.',
          },
          { role: 'user', content: text },
        ],
        max_tokens: 50,
      });
      return response.data.choices[0].message.content.trim();
    } catch (error) {
      throw new Error('Error connecting to OpenAI API: ' + error.message);
    }
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

const PORT = process.env.PORT || 3001;

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

app.post('/submit-task', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const { userId, taskId } = req.body;
    const filePath = `/uploads/${req.file.filename}`;
    const plagiarismPercentage = -1;
    const submissionDate = new Date().toLocaleString();

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

    dbModule.addCourse("Math 101", "Example", "/uploads/a.jpg", (err, courseId) => {
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

    dbModule.addTask(1,"Task1",-1,-1,(err,taskId) => {
        if (err) {
            console.error("Failed to add course:", err);
        } else {
            console.log(`Course added with ID: ${taskId}`);
        }
    })
});
