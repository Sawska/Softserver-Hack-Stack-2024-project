CREATE TABLE User_table (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_email VARCHAR(320) UNIQUE,
    user_password VARCHAR(100),
    firstname VARCHAR(100),
    lastname VARCHAR(100),
    student_status VARCHAR(50)
);

CREATE TABLE Course_table (
    id INT PRIMARY KEY AUTO_INCREMENT,
    course_name VARCHAR(100),
    professor_name VARCHAR(100)
);

CREATE TABLE Task (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_name VARCHAR(255),
    grade INT,
    grade_AI_plagiatism INT
);

CREATE TABLE User_course (
    join_id INT PRIMARY KEY AUTO_INCREMENT,
    course_id INT,
    user_id INT
);

CREATE TABLE Course_Tasks (
    join_id INT PRIMARY KEY AUTO_INCREMENT,
    course_id INT,
    task_id INT
);

CREATE TABLE Submitted_Tasks (
    join_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    task_id INT,
    submission_file VARCHAR(255)
);