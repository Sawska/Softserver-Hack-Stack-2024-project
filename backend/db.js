const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

function initTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email VARCHAR(320) UNIQUE,
        user_password VARCHAR(100),
        firstname VARCHAR(100),
        lastname VARCHAR(100),
        student_status VARCHAR(50)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS Courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_name VARCHAR(100),
        professor_name VARCHAR(100),
        image_path TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS Task (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_name VARCHAR(255),
        grade INT,
        grade_AI_plagiatism INT,
        submitted BOOLEAN DEFAULT 0,
        submission_date DATETIME
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS User_course (
        join_id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INT,
        user_id INT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS Course_Tasks (
        join_id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INT,
        task_id INT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS Submitted_Tasks (
        join_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INT,
        task_id INT,
        submission_file VARCHAR(255)
      )
    `);

    console.log("Tables initialized.");
  });
}

function addUser(email, password, firstname, lastname, studentStatus, callback) {
  const sql = `
    INSERT INTO Users (user_email, user_password, firstname, lastname, student_status) 
    VALUES (?, ?, ?, ?, ?)
  `;
  db.run(sql, [email, password, firstname, lastname, studentStatus], function (err) {
    if (err) {
      callback(err.message);
      return;
    }
    callback(null, this.lastID);
  });
}

function userExists(email, callback) {
  const sql = `SELECT id FROM Users WHERE user_email = ?`;
  db.get(sql, [email], (err, row) => {
    if (err) {
      callback(err.message, null);
      return;
    }
    callback(null, !!row);
  });
}

function validateLogin(email, password, callback) {
  const sql = `SELECT id, firstname, lastname, user_email, student_status FROM Users WHERE user_email = ? AND user_password = ?`;
  
  db.get(sql, [email, password], (err, row) => {
      if (err) {
          callback(err.message, null);
          return;
      }
      callback(null, row); 
  });
}

function getCoursesForUser(userId, callback) {
  const sql = `
    SELECT c.id, c.course_name, c.professor_name, c.image_path
    FROM User_course uc
    JOIN Courses c ON uc.course_id = c.id
    WHERE uc.user_id = ?
  `;
  db.all(sql, [userId], (err, rows) => {
    if (err) {
      callback(err.message, null);
      return;
    }
    console.log("Courses fetched for user:", rows);
    callback(null, rows);
  });
}

function getTasksForCourse(courseId, callback) {
  const sql = `
    SELECT t.id, t.task_name, t.grade, t.grade_AI_plagiatism, t.submitted, t.submission_date
    FROM Course_Tasks ct
    JOIN Task t ON ct.task_id = t.id
    WHERE ct.course_id = ?
  `;
  db.all(sql, [courseId], (err, rows) => {
    if (err) {
      callback(err.message, null);
      return;
    }
    console.log("Tasks fetched for user:", rows);
    callback(null, rows);
  });
}

function getSubmittedTasksByUser(userId, callback) {
  const sql = `
    SELECT st.join_id, t.task_name, t.grade, t.grade_AI_plagiatism, st.submission_file
    FROM Submitted_Tasks st
    JOIN Task t ON st.task_id = t.id
    WHERE st.user_id = ?
  `;
  db.all(sql, [userId], (err, rows) => {
    if (err) {
      callback(err.message, null);
      return;
    }
    callback(null, rows);
  });
}

function addSubmittedTask(userId, taskId, submissionFile, callback) {
  const sql = `
    INSERT INTO Submitted_Tasks (user_id, task_id, submission_file)
    VALUES (?, ?, ?)
  `;
  db.run(sql, [userId, taskId, submissionFile], function (err) {
    if (err) {
      callback(err.message);
      return;
    }
    callback(null, this.lastID);
  });
}

function addCourse(courseName, professorName, imagePath, callback) {
  const sql = `
    INSERT INTO Courses (course_name, professor_name, image_path)
    VALUES (?, ?, ?)
  `;
  db.run(sql, [courseName, professorName, imagePath], function (err) {
    if (err) {
      callback(err.message);
      return;
    }
    callback(null, this.lastID);
  });

}

function getTaskById(taskId, callback) {
  const sql = `SELECT id, task_name, grade, grade_AI_plagiatism, submitted, submission_date FROM Task WHERE id = ?`;

  db.get(sql, [taskId], (err, row) => {
      if (err) {
          callback(err.message, null);
          return;
      }
      callback(null, row);
  });
}
function getCourseByName(courseName, callback) {
  const sql = `
      SELECT id, course_name, professor_name, image_path
      FROM Courses
      WHERE course_name = ?
  `;

  db.get(sql, [courseName], (err, row) => {
      if (err) {
          callback(err.message, null);
          return;
      }
      callback(null, row);
  });
}


function addCourseToUser(userId, courseId, callback) {
  const sql = `
      INSERT INTO User_course (user_id, course_id)
      VALUES (?, ?)
  `;
  db.run(sql, [userId, courseId], function (err) {
      if (err) {
          console.error("Error adding course to user:", err.message);
          callback(err);
          return;
      }
      callback(null, this.lastID); 
  });
}

function getCourseById(courseId, callback) {
  const sql = `
      SELECT id, course_name, professor_name, image_path
      FROM Courses
      WHERE id = ?
  `;

  db.get(sql, [courseId], (err, row) => {
      if (err) {
          callback(err.message, null);
          return;
      }
      callback(null, row);
  });
}


function getTasksByCourseId(courseId, callback) {
  const sql = `
      SELECT t.id, t.task_name AS name, t.grade, t.grade_AI_plagiatism, t.submitted, t.submission_date
      FROM Task t
      INNER JOIN Course_Tasks ct ON t.id = ct.task_id
      WHERE ct.course_id = ?
  `;

  db.all(sql, [courseId], (err, rows) => {
      if (err) {
          console.error("Error fetching tasks:", err);
          callback("Error fetching tasks", null); 
          return;
      }
      console.log("Tasks fetched for user:", rows);
      callback(null, rows);
  });
}


const addTask = (courseId, taskName, grade, gradeAIPlagiatism, callback) => {
  db.serialize(() => {
      db.run(`
          INSERT INTO Task (task_name, grade, grade_AI_plagiatism)
          VALUES (?, ?, ?)
      `, [taskName, grade, gradeAIPlagiatism], function(err) {
          if (err) {
              return callback(err.message, null);
          }

          const taskId = this.lastID; 
          db.run(`
              INSERT INTO Course_Tasks (course_id, task_id)
              VALUES (?, ?)
          `, [courseId, taskId], function(err) {
              if (err) {
                  return callback(err.message, null);
              }
              callback(null, { taskId: taskId, joinId: this.lastID });
          });
      });
  });
};

const getCourseByTaskId = (taskId, callback) => {
  const sql = `
      SELECT c.id, c.course_name, c.professor_name
      FROM Courses c
      INNER JOIN Course_Tasks ct ON c.id = ct.course_id
      WHERE ct.task_id = ?
  `;

  db.get(sql, [taskId], (err, row) => {
      if (err) {
          callback(err.message, null);
          return;
      }
      callback(null, row);
  });
};


function updateTaskSubmissionStatus(taskId, submitted, submissionDate, callback) {
  const sql = `
      UPDATE Task 
      SET submitted = ?, submission_date = ? 
      WHERE id = ?
  `;
  db.run(sql, [submitted, submissionDate, taskId], function (err) {
      if (err) {
          callback(err.message);
          return;
      }
      callback(null);
  });
}




function getStudentsInCourse(courseId, callback) {
  const sql = `
      SELECT u.id, u.name, u.email 
      FROM Users u
      JOIN Course_Students cs ON u.id = cs.student_id
      WHERE cs.course_id = ?
  `;

  db.all(sql, [courseId], (err, rows) => {
      if (err) {
          callback(err, null);
      } else {
          callback(null, rows);
      }
  });
}

function updateGrade(userId, courseId, taskId, grade, callback) {
  if (isNaN(grade) || grade < 0 || grade > 100) {
      return callback(new Error('Invalid grade'));
  }

  const sql = `
      UPDATE TaskGrades
      SET grade = ?
      WHERE user_id = ? AND course_id = ? AND task_id = ?
  `;

  db.run(sql, [grade, userId, courseId, taskId], function (err) {
      if (err) {
          return callback(err);
      }

      if (this.changes === 0) {
          return callback(new Error('Task not found or user is not enrolled in the course'));
      }

      callback(null, { success: true, message: 'Grade updated successfully' });
  });
}

module.exports = {
  db,
  initTables,
  addUser,
  userExists,
  validateLogin,
  getCoursesForUser,
  getTasksForCourse,
  getSubmittedTasksByUser,
  addSubmittedTask,
  addCourse,
  getTaskById,
  getCourseByName,
  addCourseToUser,
  getCourseById,
  getTasksByCourseId,
  addTask,
  getCourseByTaskId,
  updateTaskSubmissionStatus,
  getStudentsInCourse,
  updateGrade
};


