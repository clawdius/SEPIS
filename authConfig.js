const express = require('express');
const app = express();
const db = require('./dbConfig');

//Setup Passport
var passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy;

//Login Validator
passport.use(new LocalStrategy({ usernameField: 'Username', passwordField: 'Password' }, function(username, password, done) {
    db.serialize(function() {
        let query = "SELECT * FROM USERS WHERE username=? AND password=? AND status= 'Aktif'"
        const userCredential = [username, password]
        db.get(query, userCredential, (err, row) => {
            if (err) throw err;
            if (row) {
                user = { username: row.USERNAME, role: row.ROLE, name: row.REAL_NAME };
                done(null, user)
            } else {
                done(null, false)
            }
        })
    })
}))

passport.serializeUser(function(user, done) {
    return done(null, user);
});

passport.deserializeUser(function(user, done) {
    return done(null, user)
})

//Auth Checker
function loginChecker(req, res, next) {
    if (req.isAuthenticated()) {
        next()
    } else {
        res.redirect('/login?error=' + 'noLogin')
    }
}

function managerOnly(req, res, next) {
    if (req.user.role == 'Manager') {
        next()
    } else {
        res.status(404)
        res.send('Whoops halaman tidak ditemukan')
    }
}

module.exports = { loginChecker, managerOnly }