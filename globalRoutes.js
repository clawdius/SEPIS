const express = require('express');
const routers = express.Router();
const passport = require('passport');
const auth = require('./authConfig');

const db = require('./dbConfig');

const dateFormat = require('dateformat');
const multer = require('multer');
const imageUploader = multer()
const sharp = require('sharp')
const fs = require('fs');

require('express-router-group');

//Early Game
routers.group(routers => {
    routers.route('/')
        .get((req, res) => {
            res.redirect('/login')
        })
    routers.route('/login')
        .get((req, res) => {
            //Ngecek apakah sudah login di session
            if (req.isAuthenticated()) {
                res.redirect('/dashboard')
            } else {
                res.render('loginMenu')
            }
        })
        .post(passport.authenticate('local', { successRedirect: '/dashboard', failureRedirect: '/login?error=' + encodeURIComponent("loginFailed") }))

    routers.route('/logout')
        .get((req, res) => {
            req.logout(function(err) {
                if (err) { return next(err); }
                res.redirect('/');
            });
        })
})

//Middle Tower
routers.group(auth.loginChecker, routers => {
    //Global Routers
    routers.group(routers => {

        //Dashboard
        routers.route('/dashboard')
            .get((req, res) => {
                let unconfirmedQuery = 'SELECT * FROM REPORT_PROPOSED WHERE USERNAME_REPORTER=? LIMIT 4';
                let globalReportQuery = 'SELECT * FROM REPORT_CURRENT C JOIN USERS U ON C.USERNAME_ASSIGNEE = U.USERNAME ORDER BY DATE_DUE ASC LIMIT 4';
                let assignedQuery = 'SELECT * FROM REPORT_CURRENT WHERE USERNAME_ASSIGNEE = ? ORDER BY DATE_DUE ASC LIMIT 4'

                let dateNow = new Date();
                let dateCheck = dateFormat(dateNow, 'yyyy-mm-dd');

                let unconfirmedResult;
                let globalReportResult;
                let assignedResult;

                switch (req.user.role) {
                    case 'User':
                        db.serialize(function() {
                            db.all(globalReportQuery, (err, rows) => {
                                globalReportResult = rows
                            }).all(assignedQuery, req.user.username, (err, rows) => {
                                assignedResult = rows
                            }).all(unconfirmedQuery, req.user.username, (err, rows) => {
                                unconfirmedResult = rows
                                res.render('dashboard/dashboardUser', {
                                    real_name: req.user.name,
                                    role: req.user.role,
                                    globalReport: globalReportResult,
                                    unconfirmed: unconfirmedResult,
                                    assigned: assignedResult,
                                    today: dateCheck
                                })
                            })
                        })
                        break;
                    case 'Manager':

                        let needConfirmationQuery = 'SELECT * FROM REPORT_PROPOSED R JOIN USERS U ON R.USERNAME_REPORTER = U.USERNAME ORDER BY R.DATE_PROPOSED DESC LIMIT 4';
                        let needReviewQuery = 'SELECT * FROM REPORT_CURRENT WHERE STATUS_CURRENT = "Terkirim" LIMIT 4';

                        let needConfirmationResult;
                        let needReviewResult;

                        db.serialize(function() {
                            db.all(globalReportQuery, (err, rows) => {
                                globalReportResult = rows
                            }).all(unconfirmedQuery, req.user.username, (err, rows) => {
                                unconfirmedResult = rows
                            }).all(assignedQuery, req.user.username, (err, rows) => {
                                assignedResult = rows
                            }).all(needConfirmationQuery, (err, rows) => {
                                needConfirmationResult = rows
                            }).all(needReviewQuery, (err, rows) => {
                                needReviewResult = rows;
                                res.render('dashboard/dashboardManager', {
                                    real_name: req.user.name,
                                    role: req.user.role,
                                    globalReport: globalReportResult,
                                    unconfirmed: unconfirmedResult,
                                    assigned: assignedResult,
                                    needConfirmation: needConfirmationResult,
                                    needReview: needReviewResult,
                                    today: dateCheck
                                })
                            })
                        })
                        break;
                }
            })

        //New Report
        routers.route('/report/new')
            .get((req, res) => {
                res.render('newReport', {
                    real_name: req.user.name,
                    role: req.user.role,
                    name: req.user.name
                })
            }).post(imageUploader.single('imgBefore'), (req, res) => {
                let dateNow = new Date();
                let dateFormatted = dateFormat(dateNow, 'yyyymmddHHMMss')

                let dateInput = dateFormat(dateNow, 'yyyy-mm-dd HH:MM:ss')

                let idPropose = req.user.username + dateFormatted;
                let imgName = idPropose;

                sharp(req.file.buffer).rotate().resize(640).toFile('assets/img_content/' + imgName + 'before.jpeg')

                let query = 'INSERT INTO REPORT_PROPOSED VALUES(?, ?, ?, ?, ?, ?, ?)'
                let variables = [idPropose,
                    req.user.username,
                    req.body.topicInput,
                    req.body.problemInput,
                    req.body.suggestInput,
                    imgName,
                    dateInput
                ]

                db.run(query, variables, (err) => {
                    if (err) throw err;
                    res.redirect('/dashboard')
                })

            })

        //Daftar Laporan Awal
        routers.route('/report/proposed')
            .get((req, res) => {

                let current = req.query.page ? req.query.page : 1

                let query =
                    "SELECT * FROM REPORT_PROPOSED WHERE USERNAME_REPORTER = ? " +
                    "LIMIT 5 " +
                    "OFFSET " + (current - 1) * 5

                let maxPageQuery = 'SELECT (COUNT(*)/5)+1 AS MAX FROM REPORT_PROPOSED WHERE USERNAME_REPORTER = ?'
                let maxPageResult;

                db.serialize(function() {
                    db.get(maxPageQuery, req.user.username, (err, row) => {
                        maxPageResult = row
                    }).all(query, req.user.username, (err, rows) => {
                        res.render('allReport/allReportProposed', {
                            real_name: req.user.name,
                            role: req.user.role,
                            maxPage: maxPageResult,
                            current: current,
                            result: rows
                        })
                    })
                })
            })

        //Detail Laporan Awal
        routers.route('/report/proposed/:idProposed')
            .get((req, res) => {
                let query = 'SELECT * FROM REPORT_PROPOSED R JOIN USERS U ON R.USERNAME_REPORTER = U.USERNAME WHERE ID_PROPOSED=?'

                let variables = req.params.idProposed

                db.get(query, variables, (err, row) => {
                    if (row == undefined) {
                        res.redirect('/dashboard?error=' + encodeURIComponent("dataNotFound"))
                    } else {
                        res.render('details/proposedReport', {
                            real_name: req.user.name,
                            username: req.user.username,
                            role: req.user.role,
                            result: row
                        })
                    }
                })
            })

        //Hapus Laporan Awal
        routers.route('/report/proposed/:idProposed/delete')
            .get((req, res) => {

                let checkUserQuery = 'SELECT * FROM REPORT_PROPOSED WHERE ID_PROPOSED=?'

                db.get(checkUserQuery, req.params.idProposed, (err, row) => {
                    if (row.USERNAME_REPORTER == req.user.username) {
                        let queryDelete = 'DELETE FROM REPORT_PROPOSED WHERE ID_PROPOSED=?'

                        let variables = req.params.idProposed

                        fs.unlinkSync('assets/img_content/' + req.params.idProposed + 'before.jpeg')

                        db.run(queryDelete, variables, (err) => {
                            res.redirect('/dashboard?success=' + encodeURIComponent("deletedReport"))
                        })
                    } else {
                        res.redirect('/dashboard?error=' + encodeURIComponent("noPermission"))
                    }
                })
            })

        //Daftar Laporan Berjalan
        routers.route('/report/current')
            .get((req, res) => {

                let current = req.query.page ? req.query.page : 1

                let query =
                    "SELECT * FROM REPORT_CURRENT C JOIN USERS U ON C.USERNAME_ASSIGNEE = U.USERNAME ORDER BY DATE_DUE ASC " +
                    "LIMIT 5 " +
                    "OFFSET " + (current - 1) * 5;

                let maxPageQuery = 'SELECT (COUNT(*)/5)+1 AS MAX FROM REPORT_CURRENT'
                let maxPageResult;

                let dateNow = new Date();
                let dateCheck = dateFormat(dateNow, 'yyyy-mm-dd');

                db.serialize(function() {
                    db.get(maxPageQuery, (err, row) => {
                        maxPageResult = row
                    }).all(query, (err, rows) => {
                        res.render('allReport/allReportCurrent', {
                            real_name: req.user.name,
                            role: req.user.role,
                            current: current,
                            maxPage: maxPageResult,
                            result: rows,
                            today: dateCheck
                        })
                    })
                })
            })

        //Detail Laporan Berjalan
        routers.route('/report/current/:idReport')
            .get((req, res) => {
                db.serialize(function() {
                    let detailQuery = 'SELECT *, ' +
                        '(SELECT REAL_NAME FROM USERS U JOIN REPORT_CURRENT C ON U.USERNAME = C.USERNAME_REPORTER WHERE C.ID_CURRENT = ?) AS REPORTER_REAL_NAME, ' +
                        '(SELECT REAL_NAME FROM USERS U JOIN REPORT_CURRENT C ON U.USERNAME = C.USERNAME_MANAGER WHERE C.ID_CURRENT = ?) AS MANAGER_REAL_NAME, ' +
                        '(SELECT REAL_NAME FROM USERS U JOIN REPORT_CURRENT C ON U.USERNAME = C.USERNAME_ASSIGNEE WHERE C.ID_CURRENT = ?) AS ASSIGNEE_REAL_NAME ' +
                        'FROM REPORT_CURRENT C ' +
                        'WHERE C.ID_CURRENT = ?'

                    db.get(detailQuery, [
                            req.params.idReport,
                            req.params.idReport,
                            req.params.idReport,
                            req.params.idReport
                        ],
                        (err, row) => {
                            if (row) {
                                res.render('details/currentReport', {
                                    result: row,
                                    real_name: req.user.name,
                                    role: req.user.role
                                })
                            } else {
                                res.redirect('/dashboard?error=' + encodeURIComponent('dataNotFound'))
                            }
                        })
                })
            })

        //Daftar Tugas Saya
        routers.route('/report/mytasks')
            .get((req, res) => {

                let current = req.query.page ? req.query.page : 1

                let query =
                    "SELECT * FROM REPORT_CURRENT WHERE USERNAME_ASSIGNEE = ? ORDER BY DATE_DUE ASC " +
                    "LIMIT 5 " +
                    "OFFSET " + (current - 1) * 5

                let maxPageQuery = 'SELECT (COUNT(*)/5)+1 AS MAX FROM REPORT_CURRENT WHERE USERNAME_ASSIGNEE = ? '
                let maxPageResult;

                let dateNow = new Date();
                let dateCheck = dateFormat(dateNow, 'yyyy-mm-dd');

                db.serialize(function() {
                    db.get(maxPageQuery, req.user.username, (err, row) => {
                        maxPageResult = row
                    }).all(query, req.user.username, (err, rows) => {
                        res.render('allReport/allMyTasks', {
                            real_name: req.user.name,
                            role: req.user.role,
                            current: current,
                            maxPage: maxPageResult,
                            result: rows,
                            today: dateCheck
                        })
                    })
                })
            })

        //Submit Tugas Saya
        routers.route('/report/current/:idReport/submit')
            .get((req, res) => {

                let detailsQuery = 'SELECT * FROM REPORT_CURRENT WHERE ID_CURRENT = ?'

                db.serialize(function() {
                    db.get(detailsQuery, req.params.idReport, (err, row) => {
                        if (row == null) {
                            res.redirect('/dashboard?error=' + encodeURIComponent('dataNotFound'))
                        } else {
                            if (row.USERNAME_ASSIGNEE != req.user.username) {
                                res.redirect('/dashboard?error=' + encodeURIComponent('noPermission'))
                            } else {
                                res.render('submitCurrentReport', {
                                    real_name: req.user.name,
                                    role: req.user.role,
                                    result: row
                                })
                            }
                        }
                    })
                })

            }).post(imageUploader.single('imgAfter'), (req, res) => {

                let date = new Date();
                let today = dateFormat(date, "yyyy-mm-dd HH:MM:ss");

                let imgName = req.params.idReport;

                sharp(req.file.buffer).rotate().resize(640).toFile('assets/img_content/' + imgName + 'after.jpeg')

                let query = "UPDATE REPORT_CURRENT SET STATUS_CURRENT = 'Terkirim', " +
                    "DATE_SUBMITTED ='" + today +
                    "', COMMENT_ASSIGNEE = ? " +
                    "WHERE ID_CURRENT = ?"

                db.run(query, [
                    req.body.commentInput,
                    req.params.idReport
                ], (err) => {
                    if (err) throw err
                    res.redirect('/dashboard?success=' + encodeURIComponent('photoUploaded'))
                })


            })

        //Daftar Laporan Selesai Saya
        routers.route('/report/finished/my')
            .get((req, res) => {

                let current = req.query.page ? req.query.page : 1

                let query =
                    'SELECT * ' +
                    'FROM REPORT_FINISHED WHERE USERNAME_ASSIGNEE = "' + req.user.username + '" ORDER BY DATE_SUBMITTED DESC ' +
                    "LIMIT 5 " +
                    "OFFSET " + (current - 1) * 5

                let maxPageQuery = 'SELECT (COUNT(*)/5)+1 AS MAX FROM REPORT_FINISHED WHERE USERNAME_ASSIGNEE = "' + req.user.username + '"'
                let maxPageResult;

                db.serialize(function() {
                    db.get(maxPageQuery, (err, row) => {
                        maxPageResult = row
                    }).all(query, (err, rows) => {
                        res.render('allReport/allReportFinishedMy', {
                            real_name: req.user.name,
                            role: req.user.role,
                            current: current,
                            maxPage: maxPageResult,
                            result: rows
                        })
                    })
                })

            })

        //Daftar Laporan Selesai
        routers.route('/report/finished')
            .get((req, res) => {

                let current = req.query.page ? req.query.page : 1

                let query =
                    'SELECT R.*, U.REAL_NAME ' +
                    'FROM REPORT_FINISHED R JOIN USERS U ON R.USERNAME_ASSIGNEE = U.USERNAME ORDER BY R.DATE_SUBMITTED DESC ' +
                    "LIMIT 5 " +
                    "OFFSET " + (current - 1) * 5

                let maxPageQuery = 'SELECT (COUNT(*)/5)+1 AS MAX FROM REPORT_FINISHED'
                let maxPageResult;

                db.serialize(function() {
                    db.get(maxPageQuery, (err, row) => {
                        maxPageResult = row
                    }).all(query, (err, rows) => {
                        res.render('allReport/allReportFinished', {
                            real_name: req.user.name,
                            role: req.user.role,
                            current: current,
                            maxPage: maxPageResult,
                            result: rows
                        })
                    })
                })

            })

        //Detail Laporan Selesai
        routers.route('/report/finished/:idFinished')
            .get((req, res) => {
                let query =
                    'SELECT *, ' +
                    '(SELECT REAL_NAME FROM USERS U JOIN REPORT_FINISHED C ON U.USERNAME = C.USERNAME_REPORTER WHERE C.ID_FINISHED = ?) AS REPORTER_REAL_NAME, ' +
                    '(SELECT REAL_NAME FROM USERS U JOIN REPORT_FINISHED C ON U.USERNAME = C.USERNAME_MANAGER WHERE C.ID_FINISHED = ?) AS MANAGER_REAL_NAME, ' +
                    '(SELECT REAL_NAME FROM USERS U JOIN REPORT_FINISHED C ON U.USERNAME = C.USERNAME_ASSIGNEE WHERE C.ID_FINISHED = ?) AS ASSIGNEE_REAL_NAME ' +
                    "FROM REPORT_FINISHED WHERE ID_FINISHED = ?"

                db.serialize(function() {
                    db.get(query, [
                        req.params.idFinished,
                        req.params.idFinished,
                        req.params.idFinished,
                        req.params.idFinished
                    ], (err, row) => {
                        res.render('details/finishedReport', {
                            real_name: req.user.name,
                            role: req.user.role,
                            result: row
                        })
                    })
                })
            })

    })

    //Manager Only Access
    routers.group(auth.managerOnly, routers => {

        //Daftar Konfirmasi Laporan Awal
        routers.route('/report/confirmation/')
            .get((req, res) => {

                let current = req.query.page ? req.query.page : 1

                let query =
                    "SELECT * FROM REPORT_PROPOSED R JOIN USERS U ON R.USERNAME_REPORTER = U.USERNAME ORDER BY R.DATE_PROPOSED DESC " +
                    "LIMIT 5 " +
                    "OFFSET " + (current - 1) * 5

                let maxPageQuery = 'SELECT (COUNT(*)/5)+1 AS MAX FROM REPORT_PROPOSED'
                let maxPageResult;

                db.serialize(function() {
                    db.get(maxPageQuery, (err, row) => {
                        maxPageResult = row
                    }).all(query, (err, rows) => {
                        res.render('allReport/allNeedConfirmation', {
                            real_name: req.user.name,
                            role: req.user.role,
                            maxPage: maxPageResult,
                            current: current,
                            result: rows
                        })
                    })
                })
            })

        //Detail Konfirmasi Laporan Awal
        routers.route('/report/confirmation/:idProposed')
            .get((req, res) => {
                let query = 'SELECT * FROM REPORT_PROPOSED R JOIN USERS U ON R.USERNAME_REPORTER = U.USERNAME WHERE ID_PROPOSED=?'
                let usersQuery = 'SELECT REAL_NAME, USERNAME FROM USERS WHERE STATUS = "Aktif"'

                let variables = req.params.idProposed

                let date = new Date();
                let today = dateFormat(date, "yyyy-mm-dd");

                let queryResult;
                let usersResult;

                db.serialize(function() {
                    db.get(query, variables, (err, row) => {
                        if (row == undefined) {
                            res.redirect('/dashboard?error=' + encodeURIComponent("dataNotFound"))
                        } else {
                            queryResult = row;
                        }
                    }).all(usersQuery, (err, rows) => {
                        usersResult = rows;
                        res.render('confirmationReport', {
                            real_name: req.user.name,
                            role: req.user.role,
                            users: usersResult,
                            result: queryResult,
                            today: today
                        })
                    })
                })


            }).post((req, res) => {

                let confirmQuery =
                    "INSERT INTO REPORT_CURRENT " +
                    "SELECT ID_PROPOSED, USERNAME_REPORTER, ?, " +
                    "(SELECT USERNAME FROM USERS WHERE REAL_NAME = ?)" +
                    ", TOPIC_PROPOSED, PROBLEM_PROPOSED, ?, IMAGE_PROPOSED, DATE_PROPOSED, ?, '-' ,'Open', '', '' FROM REPORT_PROPOSED " +
                    "WHERE ID_PROPOSED = ?"

                let confirmDeleteQuery = 'DELETE FROM REPORT_PROPOSED WHERE ID_PROPOSED=?'

                db.serialize(function() {
                    db.run(confirmQuery, [
                            req.user.username,
                            req.body.PICInput,
                            req.body.suggestInput,
                            req.body.duedateInput,
                            req.params.idProposed
                        ])
                        .run(confirmDeleteQuery, req.params.idProposed, (err) => {
                            res.redirect('/dashboard?success=' + encodeURIComponent('dataConfirmed'))
                        })
                })
            })

        //Ganti PIC dan Due Date
        routers.route('/report/current/:idCurrent/assign')
            .get((req, res) => {

                let date = new Date();
                let today = dateFormat(date, "yyyy-mm-dd");

                let usersQuery = 'SELECT REAL_NAME FROM USERS WHERE STATUS = "Aktif"'
                let detailQuery = 'SELECT *, ' +
                    '(SELECT REAL_NAME FROM USERS U JOIN REPORT_CURRENT C ON U.USERNAME = C.USERNAME_ASSIGNEE WHERE C.ID_CURRENT = ?) AS ASSIGNEE_REAL_NAME ' +
                    'FROM REPORT_CURRENT ' +
                    'WHERE ID_CURRENT = ?'

                let usersResult;
                let detailResult;

                db.serialize(function() {
                    db.get(detailQuery, [
                        req.params.idCurrent,
                        req.params.idCurrent
                    ], (err, row) => {
                        detailResult = row
                    }).all(usersQuery, (err, rows) => {
                        usersResult = rows
                        res.render('changeReportPIC', {
                            real_name: req.user.name,
                            role: req.user.role,
                            details: detailResult,
                            today: today,
                            users: usersResult
                        })
                    })
                })
            }).post((req, res) => {
                let updateQuery = 'UPDATE REPORT_CURRENT ' +
                    'SET USERNAME_ASSIGNEE = (SELECT USERNAME FROM USERS WHERE REAL_NAME = ?), ' +
                    'DATE_DUE = ? WHERE ID_CURRENT = ?'

                db.run(updateQuery, [
                    req.body.PICInput,
                    req.body.duedateInput,
                    req.params.idCurrent
                ], (err) => {
                    if (err) throw err;
                    res.redirect('/dashboard?success=' + encodeURIComponent('dataUpdated'))
                })
            })

        //Daftar Review Tindak Lanjut
        routers.route('/report/review/')
            .get((req, res) => {

                let current = req.query.page ? req.query.page : 1

                let query =
                    'SELECT * FROM REPORT_CURRENT WHERE STATUS_CURRENT = "Terkirim" ' +
                    "LIMIT 5 " +
                    "OFFSET " + (current - 1) * 5

                let maxPageQuery = 'SELECT (COUNT(*)/5)+1 AS MAX FROM REPORT_CURRENT WHERE STATUS_CURRENT = "Terkirim"'
                let maxPageResult;

                db.serialize(function() {
                    db.get(maxPageQuery, (err, row) => {
                        maxPageResult = row
                    }).all(query, (err, rows) => {
                        res.render('allReport/allReportReview', {
                            real_name: req.user.name,
                            role: req.user.role,
                            maxPage: maxPageResult,
                            current: current,
                            result: rows
                        })
                    })
                })
            })

        //Detail Review Tindak Lanjut
        routers.route('/report/review/:idCurrent/')
            .get((req, res) => {

                let query = "SELECT * FROM REPORT_CURRENT WHERE ID_CURRENT = ?"

                let queryResult;

                db.get(query, [
                    req.params.idCurrent
                ], (err, row) => {
                    queryResult = row;
                    res.render('reviewReport', {
                        real_name: req.user.name,
                        role: req.user.role,
                        result: queryResult
                    })
                })
            })

        //Tutup Laporan Akhir
        routers.route('/report/review/:idCurrent/accept')
            .get((req, res) => {

                let insertQuery =
                    'INSERT INTO REPORT_FINISHED ' +
                    'SELECT ID_CURRENT, USERNAME_REPORTER, USERNAME_MANAGER, USERNAME_ASSIGNEE, ' +
                    'TOPIC_CURRENT, PROBLEM_CURRENT, SUGGEST_CURRENT, IMAGE_CURRENT, ' +
                    'DATE_CREATED, DATE_DUE, DATE_SUBMITTED, COMMENT_ASSIGNEE, COMMENT_MANAGER FROM REPORT_CURRENT ' +
                    'WHERE ID_CURRENT = ?'

                let deleteQuery =
                    'DELETE FROM REPORT_CURRENT WHERE ID_CURRENT = ?'

                db.serialize(function() {
                    db.run(insertQuery, [
                        req.params.idCurrent
                    ]).run(deleteQuery, [
                        req.params.idCurrent
                    ], (err) => {
                        res.redirect('/dashboard?success=' + encodeURIComponent('dataClosed'))
                    })
                })

            })

        //Pending Laporan Akhir
        routers.route('/report/review/:idCurrent/pending')
            .post((req, res) => {
                let updateQuery =
                    "UPDATE REPORT_CURRENT SET STATUS_CURRENT = 'Pending', " +
                    "COMMENT_MANAGER = ? WHERE ID_CURRENT = ?"

                db.serialize(function() {
                    db.run(updateQuery, [
                        req.body.commentInput,
                        req.params.idCurrent
                    ], (err) => {
                        res.redirect('/dashboard?success=' + encodeURIComponent('dataPending'))
                    })
                })
            })

        //Tolak Laporan Awal
        routers.route('/report/confirmation/:idProposed/reject')
            .get((req, res) => {

                let rejectArchiveQuery =
                    "INSERT INTO REPORT_REJECTED " +
                    "SELECT ID_PROPOSED, USERNAME_REPORTER, ?, TOPIC_PROPOSED, PROBLEM_PROPOSED, SUGGEST_PROPOSED, IMAGE_PROPOSED, DATE_PROPOSED FROM REPORT_PROPOSED " +
                    "WHERE ID_PROPOSED = ?"

                let rejectDeleteQuery = 'DELETE FROM REPORT_PROPOSED WHERE ID_PROPOSED=?'


                fs.renameSync(
                    'assets/img_content/' + req.params.idProposed + 'before.jpeg',
                    'assets/img_content/' + req.params.idProposed + 'rejected.jpeg')

                db.serialize(function() {
                    db.run(rejectArchiveQuery, [
                            req.user.username,
                            req.params.idProposed
                        ])
                        .run(rejectDeleteQuery, req.params.idProposed, (err) => {
                            res.redirect('/dashboard?success=' + encodeURIComponent('dataRejected'))
                        })
                })

            })

        //Daftar Laporan Tertolak
        routers.route('/report/rejected')
            .get((req, res) => {

                let current = req.query.page ? req.query.page : 1

                let query =
                    'SELECT R.*, U.REAL_NAME ' +
                    'FROM REPORT_REJECTED R JOIN USERS U ON R.USERNAME_REPORTER = U.USERNAME ORDER BY R.DATE_REJECTED DESC ' +
                    "LIMIT 5 " +
                    "OFFSET " + (current - 1) * 5

                let maxPageQuery = 'SELECT (COUNT(*)/5)+1 AS MAX FROM REPORT_REJECTED'
                let maxPageResult;

                db.serialize(function() {
                    db.get(maxPageQuery, (err, row) => {
                        maxPageResult = row
                    }).all(query, (err, rows) => {
                        res.render('allReport/allReportRejected', {
                            real_name: req.user.name,
                            role: req.user.role,
                            maxPage: maxPageResult,
                            current: current,
                            result: rows
                        })
                    })
                })
            })

        //Detail Laporan Tertolak
        routers.route('/report/rejected/:idRejected')
            .get((req, res) => {
                let query =
                    'SELECT *, ' +
                    '(SELECT REAL_NAME FROM USERS U JOIN REPORT_REJECTED R ON U.USERNAME = R.USERNAME_REPORTER WHERE ID_REJECTED = ?) AS REPORTER_REAL_NAME, ' +
                    '(SELECT REAL_NAME FROM USERS U JOIN REPORT_REJECTED R ON U.USERNAME = R.USERNAME_MANAGER WHERE ID_REJECTED = ?) AS MANAGER_REAL_NAME ' +
                    ' FROM REPORT_REJECTED WHERE ID_REJECTED = ?'

                db.serialize(function() {
                    db.get(query, [
                        req.params.idRejected,
                        req.params.idRejected,
                        req.params.idRejected
                    ], (err, row) => {
                        res.render('details/rejectedReport', {
                            real_name: req.user.name,
                            role: req.user.role,
                            result: row
                        })
                    })
                })
            })

        //Daftar Semua User
        routers.route('/users')
            .get((req, res) => {

                let current = req.query.page ? req.query.page : 1

                let query =
                    'SELECT USERNAME, REAL_NAME FROM USERS ' +
                    "LIMIT 5 " +
                    "OFFSET " + (current - 1) * 5

                let maxPageQuery = 'SELECT (COUNT(*)/5)+1 AS MAX FROM USERS'
                let maxPageResult;

                db.serialize(function() {
                    db.get(maxPageQuery, (err, row) => {
                        maxPageResult = row
                    }).all(query, (err, rows) => {
                        res.render('users/allUsers', {
                            real_name: req.user.name,
                            role: req.user.role,
                            maxPage: maxPageResult,
                            current: current,
                            result: rows
                        })
                    })
                })
            })

        //Tambah User
        routers.route('/users/add')
            .get((req, res) => {
                res.render('users/newUser', {
                    real_name: req.user.name,
                    role: req.user.role
                })
            }).post((req, res) => {
                let query = 'INSERT INTO USERS VALUES(?, ?, ?, ?, ?)'

                db.serialize(function() {
                    db.run(query, [
                        req.body.usernameAdd,
                        req.body.passwordConfirm,
                        req.body.roleAdd,
                        req.body.nameAdd,
                        'Aktif'
                    ], (err) => {
                        res.redirect('/users?success=' + encodeURIComponent('userAdded'))
                    })
                })
            })

        //Detail User
        routers.route('/users/:username')
            .get((req, res) => {
                let query =
                    'SELECT REAL_NAME, USERNAME, STATUS, ' +
                    '(SELECT COUNT(*) FROM REPORT_FINISHED WHERE USERNAME_ASSIGNEE = ?) AS FINISHED, ' +
                    '(SELECT COUNT(*) FROM REPORT_CURRENT WHERE USERNAME_ASSIGNEE = ?) AS CURRENT ' +
                    'FROM USERS WHERE USERNAME = ?'

                let detail =
                    'SELECT * FROM REPORT_FINISHED WHERE USERNAME_ASSIGNEE = ? ORDER BY DATE_SUBMITTED DESC LIMIT 5'

                let detailResult;

                db.serialize(function() {
                    db.all(detail, req.params.username, (err, rows) => {
                        detailResult = rows
                    }).get(query, [
                        req.params.username,
                        req.params.username,
                        req.params.username
                    ], (err, row) => {
                        res.render('users/detailUser.ejs', {
                            real_name: req.user.name,
                            role: req.user.role,
                            detail: detailResult,
                            result: row
                        })
                    })
                })
            })

        //Edit User
        routers.route('/users/:username/edit')
            .get((req, res) => {
                let query = "SELECT * FROM USERS WHERE USERNAME = ?"

                db.serialize(function() {
                    db.get(query, req.params.username, (err, row) => {
                        res.render('users/editUser', {
                            real_name: req.user.name,
                            role: req.user.role,
                            result: row
                        })
                    })
                })
            }).post((req, res) => {
                let input = req.body.passwordInput;

                if (input !== "") {
                    let query = 'UPDATE USERS SET REAL_NAME = ?, PASSWORD = ? WHERE USERNAME = ?'

                    db.serialize(function() {
                        db.run(query, [
                            req.body.name,
                            input,
                            req.params.username
                        ], (err) => {
                            res.redirect('/users')
                        })
                    })
                } else {
                    let query = 'UPDATE USERS SET REAL_NAME = ? WHERE USERNAME = ?'

                    db.serialize(function() {
                        db.run(query, [
                            req.body.name,
                            req.params.username
                        ], (err) => {
                            res.redirect('/users')
                        })
                    })
                }
            })

        //Nonaktifkan User
        routers.route('/users/:username/deactivate')
            .get((req, res) => {
                let query = 'UPDATE USERS SET status = "Nonaktif" WHERE USERNAME = ?'

                db.serialize(function() {
                    db.run(query, req.params.username, (err) => {
                        res.redirect('/users?success=' + encodeURIComponent('userDeactivated'))
                    })
                })
            })

        //Aktifkan User
        routers.route('/users/:username/activate')
            .get((req, res) => {
                let query = 'UPDATE USERS SET status = "Aktif" WHERE USERNAME = ?'

                db.serialize(function() {
                    db.run(query, req.params.username, (err) => {
                        res.redirect('/users?success=' + encodeURIComponent('userActivated'))
                    })
                })
            })
    })

})

module.exports = routers;