// // Import necessary modules
// import express from 'express';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import bodyParser from 'body-parser';
// import mysql from 'mysql';
// import session from 'express-session';
// import fileUpload from 'express-fileupload';
// import multer from 'multer';




// // Create an instance of the Express application
// const app = express();
// // const upload = multer({ dest: 'uploads/' });

// // Set up body parser middleware
// app.use(bodyParser.urlencoded({ extended: true }));
// // app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// app.use(bodyParser.json());

// // Set up session middleware
// app.use(session({
//     secret: 'your_secret_key',
//     resave: false,
//     saveUninitialized: true
// }));

// // Set up file upload middleware
// const upload = multer({ dest: 'uploads/' });


// // MySQL Database Configuration
// const dbConfig = {
//     host: 'localhost',
//     user: 'root',
//     password: '', // Replace with your MySQL password
//     database: 'echoresolve'
// };

// // Create MySQL connection pool
// const pool = mysql.createPool(dbConfig);

// // Set views directory using import.meta.url and path module
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// app.set("views", path.join(__dirname, "views"));
// app.set("view engine", "ejs");


// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// // app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// // Middleware to check session
// function checkSession(req, res, next) {
//     if (req.session && req.session.username) {
//         next();
//     } else {
//         res.redirect('/login');
//     }
// }

// // Setup view engine
// app.set('view engine', 'ejs');




// Import necessary modules
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import mysql from 'mysql';
import session from 'express-session';
import fs from 'fs';
import multer from 'multer';

// Create an instance of the Express application
const app = express();

// Set up body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set up session middleware
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Set up file upload middleware
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// MySQL Database Configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // Replace with your MySQL password
    database: 'echoresolve'
};

// Create MySQL connection pool
const pool = mysql.createPool(dbConfig);

// Set views directory using import.meta.url and path module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Serve static files from the "uploads" directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware to check session
function checkSession(req, res, next) {
    if (req.session && req.session.username) {
        next();
    } else {
        res.redirect('/login');
    }
}




// Route to render direct application form
app.get('/direct_application', checkSession, (req, res) => {
    const username = req.session.username;

    pool.getConnection((err, connection) => {
        if (err) {
            return res.status(500).send("Database connection failed: " + err.stack);
        }

        const sql = "SELECT first_name, email_id, mobile_no, department_id FROM emp WHERE username = ?";
        connection.query(sql, [username], (error, results) => {
            connection.release();
            if (error) {
                return res.status(500).send("Error fetching employee information: " + error.stack);
            }

            const emp_info = results.length > 0 ? results[0] : {};
            res.render('direct_application', { username, emp_info });
        });
    });
});

// Route to handle form submission
app.post('/direct_application', checkSession, upload.single('attachment'), (req, res) => {
    const { query_type, sub_query_type, description, additional_info, name, email, phone, department } = req.body;
    const username = req.session.username;
    let file_dest = null;

    if (req.file) {
        // Verify the file integrity
        const fileBuffer = fs.readFileSync(req.file.path);
        if (!fileBuffer) {
            return res.status(400).send("File upload failed, please try again.");
        }

        file_dest = req.file.path;
    }

    const date = new Date();
    const unique_number = Date.now();
    const query_number = `EchoResolve/${query_type}/${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}/${unique_number}`;

    let concerned_department = 0;
    switch (query_type) {
        case 'code':
            concerned_department = 1;
            break;
        case 'concept':
            concerned_department = 2;
            break;
        case 'platform':
            concerned_department = 3;
            break;
        case 'other':
            concerned_department = 4;
            break;
    }

    pool.getConnection((err, connection) => {
        if (err) {
            return res.status(500).send("Database connection failed: " + err.stack);
        }

        const sql = `INSERT INTO applications 
                     (username, name, email, phone, department, query_type, sub_query_type, description, additional_info, query_number, attachment, concerned_department)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        connection.query(sql, [username, name, email, phone, department, query_type, sub_query_type, description, additional_info, query_number, file_dest, concerned_department], (error) => {
            connection.release();
            if (error) {
                return res.status(500).send("Error submitting query: " + error.stack);
            }

            res.redirect('/pre_status');
        });
    });
});

// Route to view application
app.get('/view_application', (req, res) => {
    if (!req.session.username) {
        res.redirect('/login'); // Redirect to login if user is not authenticated
        return;
    }

    const query_number = req.query.query_number;
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting MySQL connection: ' + err.message);
            res.status(500).send('Internal Server Error');
            return;
        }

        const sql = "SELECT * FROM applications WHERE query_number = ?";
        connection.query(sql, [query_number], (err, results) => {
            connection.release(); // Release the connection

            if (err) {
                console.error('Error executing MySQL query: ' + err.message);
                res.status(500).send('Internal Server Error');
                return;
            }

            if (results.length === 0) {
                res.status(404).send('Application not found');
                return;
            }

            const application = results[0];
            res.render('view_application', { application });
        });
    });
});



// Route to render resolve form
app.get('/resolve', checkSession, (req, res) => {
    const { id, dynamic_role } = req.query;
    const message = '';

    res.render('resolve', { id, dynamic_role, message });
});


// Route to handle resolve form submission
app.post('/resolve', checkSession, upload.single('solution_attachment'), (req, res) => {
    const { id, dynamic_role } = req.query;
    const remarks = req.body.remarks;
    let solutionAttachment = '';

    if (req.file) {
        solutionAttachment = req.file.path;
    }

    let sql = '';
    if (dynamic_role === 'support1') {
        sql = "UPDATE applications SET support1_status = 1, solution = ?, solution_attachment = ? WHERE query_number = ?";
    } else if (dynamic_role === 'support2') {
        sql = "UPDATE applications SET support2_status = 1, solution = ?, solution_attachment = ? WHERE query_number = ?";
    } else if (dynamic_role === 'support3') {
        sql = "UPDATE applications SET support3_status = 1, solution = ?, solution_attachment = ? WHERE query_number = ?";
    } else {
        return res.status(403).send("Unauthorized access.");
    }

    pool.getConnection((err, connection) => {
        if (err) {
            return res.status(500).send("Database connection failed: " + err.stack);
        }

        connection.query(sql, [remarks, solutionAttachment, id], (error, results) => {
            connection.release();
            if (error) {
                return res.status(500).send("Error: " + error.stack);
            }

            const message = "Query resolved successfully.";
            res.render('resolve', { id, dynamic_role, message });
        });
    });
});

// Routes
app.get("/", (req, res) => {
    res.redirect("/login");
});
// Register route
app.get('/register', (req, res) => {
    res.render('register', { errorMessage: '' });
});

app.post('/register', (req, res) => {
    const {
        username, password, email_id, first_name, middle_name,
        last_name, gender, dob, mobile_no, department_id
    } = req.body;

    const query = `
        INSERT INTO emp (username, password, email_id, first_name, middle_name, last_name, gender, dob, mobile_no, department_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    pool.query(query, [
        username, password, email_id, first_name, middle_name,
        last_name, gender, dob, mobile_no, department_id
    ], (err, results) => {
        if (err) {
            return res.render('register', { errorMessage: err.message });
        }
        res.redirect('/login');
    });
});

// Login route
app.get("/login", (req, res) => {
    res.render("login", { error_message: null });
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;

    // Example query to validate user credentials
    const query = "SELECT * FROM emp WHERE username = ? AND password = ?";
    pool.query(query, [username, password], (error, results) => {
        if (error) {
            console.error('Error executing MySQL query:', error);
            res.render("error", { error_message: "Error connecting to database." });
        } else if (results.length === 0) {
            const error_message = "Incorrect username or password.";
            res.render("login", { error_message });
        } else {
            req.session.username = username;
            res.redirect("/dashboard");
        }
    });
});

// Dashboard route
app.get("/dashboard", (req, res) => {
    const username = req.session.username;
    if (!username) {
        res.redirect("/login");
        return;
    }

    // Example query to fetch user details
    const query = "SELECT id, first_name, middle_name, last_name, gender, dob, email_id, mobile_no, department_id FROM emp WHERE username = ?";
    pool.query(query, [username], (error, results) => {
        if (error || results.length === 0) {
            res.render("error", { error_message: "User not found." });
        } else {
            const user = results[0];
            res.render("dashboard", { username, user }); // Pass user data to dashboard.ejs
        }
    });
});


// Inbox route
app.get("/inbox", (req, res) => {
    const username = req.session.username;
    if (!username) {
        res.redirect("/login");
        return;
    }

    // Fetch employee details for the current session user
    const sqlEmp = "SELECT * FROM emp WHERE username = ?";
    pool.query(sqlEmp, [username], (error, resultsEmp) => {
        if (error || resultsEmp.length === 0) {
            res.render("error", { error_message: "Error fetching employee data." });
            return;
        }

        const empData = resultsEmp[0];
        const currentSessionUserId = empData.id;

        // Fetch all applications
        const sqlApplications = "SELECT * FROM applications";
        pool.query(sqlApplications, (error, resultsApplications) => {
            if (error) {
                res.render("error", { error_message: "Error fetching applications." });
                return;
            }

            const applications = resultsApplications.map(row => {
                return new Promise((resolve, reject) => {
                    const concernedDepartment = row.concerned_department;

                    // Fetch support information from department_info table
                    const sqlGroupInfo = "SELECT support1, support2, support3 FROM department_info WHERE department_id = ?";
                    pool.query(sqlGroupInfo, [concernedDepartment], (error, resultsGroupInfo) => {
                        if (error || resultsGroupInfo.length === 0) {
                            reject("Error fetching group info.");
                            return;
                        }

                        const groupInfo = resultsGroupInfo[0];
                        let support1Status = row.support1_status;
                        let support2Status = row.support2_status;
                        let support3Status = row.support3_status;

                        // Fetch applicant ID using the username from the applications table
                        const applicantUsername = row.username;
                        const sqlApplicantId = "SELECT id FROM emp WHERE username = ?";
                        pool.query(sqlApplicantId, [applicantUsername], (error, resultsApplicantId) => {
                            if (error || resultsApplicantId.length === 0) {
                                reject("Error fetching applicant ID.");
                                return;
                            }

                            const applicantId = resultsApplicantId[0].id;

                            if (applicantId === groupInfo.support1) {
                                support1Status = 1;
                            }

                            if (applicantId === groupInfo.support2) {
                                support2Status = 1;
                                support1Status = 1;
                            }

                            if (applicantId === groupInfo.support3) {
                                support3Status = 1;
                                support2Status = 1;
                                support1Status = 1;
                            }

                            const queryNumber = row.query_number;
                            const sqlUpdateStatus = `
                                UPDATE applications 
                                SET support1_status = ?, support2_status = ?, support3_status = ?
                                WHERE query_number = ?`;
                            pool.query(sqlUpdateStatus, [support1Status, support2Status, support3Status, queryNumber], (error) => {
                                if (error) {
                                    reject("Error updating application status.");
                                    return;
                                }

                                // Determine the role of the current session user with respect to the applicant's application
                                if (currentSessionUserId === groupInfo.support1) {
                                    row.dynamic_role = 'support1';
                                } else if (currentSessionUserId === groupInfo.support2) {
                                    row.dynamic_role = 'support2';
                                } else if (currentSessionUserId === groupInfo.support3) {
                                    row.dynamic_role = 'support3';
                                } else {
                                    row.dynamic_role = 'employee';
                                }

                                row.support1_status = support1Status;
                                row.support2_status = support2Status;
                                row.support3_status = support3Status;
                                resolve(row);
                            });
                        });
                    });
                });
            });

            Promise.all(applications)
                .then(applications => {
                    res.render("inbox2", { applications });
                })
                .catch(error => {
                    res.render("error", { error_message: error });
                });
        });
    });
});


// Pre Status route
app.get("/pre_status", (req, res) => {
    const username = req.session.username;
    if (!username) {
        res.redirect("/login");
        return;
    }

    const query = "SELECT query_number, query_type, sub_query_type FROM applications WHERE username = ? ORDER BY query_number DESC";
    pool.query(query, [username], (error, results) => {
        if (error) {
            res.render("error", { error_message: "Error retrieving applications." });
        } else {
            res.render("pre_status", { applications: results });
        }
    });
});

// Route to handle the application status
app.get('/status', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }

    const username = req.session.username;
    const id = req.query.id || req.body.id;

    pool.getConnection((err, connection) => {
        if (err) {
            return res.status(500).send("Connection failed: " + err.message);
        }

        const sql = "SELECT * FROM applications WHERE query_number = ?";
        connection.query(sql, [id], (error, results) => {
            connection.release();
            if (error) {
                return res.status(500).send("Query failed: " + error.message);
            }

            res.render('status', {
                username: username,
                applications: results
            });
        });
    });
});


// Route to render feedback details
app.get('/user_print_feedback', (req, res) => {
    const query_number = req.query.query_number;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Database connection failed: " + err.stack);
            res.status(500).send("Database connection failed");
            return;
        }

        const sql = "SELECT * FROM feedback WHERE id = ?";
        connection.query(sql, [query_number], (error, results) => {
            connection.release();
            if (error) {
                console.error("Query failed: " + error.stack);
                res.status(500).send("Query failed");
                return;
            }

            if (results.length > 0) {
                const row = results[0];
                res.render('user_print_feedback', { feedback: row });
            } else {
                res.send("No record found.");
            }
        });
    });
});
// Route to render feedback form
app.get('/feedback', checkSession, (req, res) => {
    const id = req.query.id;
    const username = req.session.username;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Database connection failed: " + err.stack);
            res.status(500).send("Database connection failed");
            return;
        }

        const sql = "SELECT * FROM applications WHERE query_number = ?";
        connection.query(sql, [id], (error, results) => {
            connection.release();
            if (error) {
                console.error("Query failed: " + error.stack);
                res.status(500).send("Query failed");
                return;
            }

            if (results.length > 0) {
                const application = results[0];
                if (application.feedback_submitted == 1) {
                    return res.redirect(`/user_print_feedback?submitted_by=${username}&query_number=${id}`);
                }
                res.render('feedback', { username, application });
            } else {
                res.send("Application not found.");
            }
        });
    });
});

// Route to handle feedback form submission
app.post('/feedback', checkSession, (req, res) => {
    const id = req.query.id;
    const { programme_type, overview, effectiveness, conduct, instructor } = req.body;
    const submitted_by = req.session.username;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Database connection failed: " + err.stack);
            res.status(500).send("Database connection failed");
            return;
        }

        const insertFeedback = "INSERT INTO feedback (programme_type, overview, submitted_by, id, effectiveness, conduct, instructor) VALUES (?, ?, ?, ?, ?, ?, ?)";
        connection.query(insertFeedback, [programme_type, overview, submitted_by, id, effectiveness, conduct, instructor], (error, results) => {
            if (error) {
                console.error("Query failed: " + error.stack);
                res.status(500).send("Query failed");
                connection.release();
                return;
            }

            const updateApplication = "UPDATE applications SET feedback_submitted = 1 WHERE query_number = ?";
            connection.query(updateApplication, [id], (error, results) => {
                connection.release();
                if (error) {
                    console.error("Query failed: " + error.stack);
                    res.status(500).send("Query failed");
                    return;
                }

                res.redirect('/pre_status');
            });
        });
    });
});


// Route to render forward form
app.get('/forward', checkSession, (req, res) => {
    const { id, dynamic_role } = req.query;
    const message = '';

    res.render('forward', { id, dynamic_role, message });
});

// Route to handle forward form submission
app.post('/forward', checkSession, (req, res) => {
    const { id, dynamic_role } = req.query;
    let sql = '';

    switch (dynamic_role) {
        case 'support1':
            sql = "UPDATE applications SET support1_status = -1 WHERE query_number = ?";
            break;
        case 'support2':
            sql = "UPDATE applications SET support2_status = -1 WHERE query_number = ?";
            break;
        default:
            return res.status(403).send("Unauthorized access.");
    }

    pool.getConnection((err, connection) => {
        if (err) {
            return res.status(500).send("Database connection failed: " + err.stack);
        }

        connection.query(sql, [id], (error, results) => {
            connection.release();
            if (error) {
                return res.status(500).send("Error: " + error.stack);
            }

            const message = "Application forwarded successfully!";
            res.render('forward', { id, dynamic_role, message });
        });
    });
});


// Route to render chat with support form
app.get('/chat_with_support', checkSession, (req, res) => {
    const { query_number } = req.query;
    const username = req.session.username;
    let messages = [];

    pool.getConnection((err, connection) => {
        if (err) {
            return res.status(500).send("Database connection failed: " + err.stack);
        }

        const sql_messages = "SELECT * FROM chat_messages WHERE query_number = ? ORDER BY timestamp ASC";
        connection.query(sql_messages, [query_number], (error, results) => {
            connection.release();
            if (error) {
                return res.status(500).send("Error fetching messages: " + error.stack);
            }

            messages = results.map(message => ({
                sender: message.sender,
                message: message.message,
                timestamp: message.timestamp
            }));

            res.render('chat_with_support', { username, query_number, messages });
        });
    });
});

// Route to handle chat message submission
app.post('/chat_with_support', checkSession, (req, res) => {
    const { query_number } = req.body;
    const message = req.body.message;
    const username = req.session.username;

    pool.getConnection((err, connection) => {
        if (err) {
            return res.status(500).send("Database connection failed: " + err.stack);
        }

        const sql_insert_message = "INSERT INTO chat_messages (sender, receiver, query_number, message, timestamp) VALUES (?, 'support', ?, ?, NOW())";
        connection.query(sql_insert_message, [username, query_number, message], (error) => {
            connection.release();
            if (error) {
                return res.status(500).send("Error sending message: " + error.stack);
            }

            res.redirect(`/chat_with_support?query_number=${query_number}`);
        });
    });
});

// Route to render chat with applicant form
app.get('/chat_with_applicant', checkSession, (req, res) => {
    const { query_number, applicant } = req.query;
    const username = req.session.username;
    let messages = [];

    if (!query_number || !applicant) {
        return res.status(400).send("Missing query number or applicant.");
    }

    pool.getConnection((err, connection) => {
        if (err) {
            return res.status(500).send("Database connection failed: " + err.stack);
        }

        const sql_messages = "SELECT * FROM chat_messages WHERE query_number = ? ORDER BY timestamp ASC";
        connection.query(sql_messages, [query_number], (error, results) => {
            connection.release();
            if (error) {
                return res.status(500).send("Error fetching messages: " + error.stack);
            }

            messages = results.map(message => ({
                sender: message.sender,
                message: message.message,
                timestamp: message.timestamp
            }));

            res.render('chat_with_applicant', { username, query_number, applicant, messages });
        });
    });
});

// Route to handle chat message submission
app.post('/chat_with_applicant', checkSession, (req, res) => {
    const { query_number, applicant, message } = req.body;
    const username = req.session.username;

    if (!query_number || !applicant || !message) {
        return res.status(400).send("Missing required fields.");
    }

    pool.getConnection((err, connection) => {
        if (err) {
            return res.status(500).send("Database connection failed: " + err.stack);
        }

        const sql_insert_message = "INSERT INTO chat_messages (sender, receiver, query_number, message, timestamp) VALUES (?, ?, ?, ?, NOW())";
        connection.query(sql_insert_message, [username, applicant, query_number, message], (error) => {
            connection.release();
            if (error) {
                return res.status(500).send("Error sending message: " + error.stack);
            }

            res.redirect(`/chat_with_applicant?query_number=${query_number}&applicant=${applicant}`);
        });
    });
});


// Logout route
app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.render("error", { error_message: "Error logging out." });
        }
        res.redirect("/login");
    });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});