const express = require('express');

const OS = require('os');
const Adress = OS.networkInterfaces()

const session = require('express-session');
const SQLiteSession = require('connect-sqlite3')(session)

const app = express();
const passport = require('passport')
const path = require('path')

//Start Server
const port = 8090

app.listen(port);

//Introduction
console.log('------------------')
console.log('prosperoSEPIS v1.0')
console.log('------------------')
console.log('')
console.log('')
console.log('')
console.log('Pastikan device yang ingin mengakses aplikasi tehubung via Wi-fi dengan komputer ini')
console.log('')
console.log('')
console.log('*Untuk mematikan server, tutup saja window ini*')

//Session
app.use(session({
    secret: "akuCintaSeoyoung",
    store: new SQLiteSession({ db: 'sessions.db' }),
    cookie: { maxAge: 60 * 60 * 1000 },
    resave: false,
    saveUninitialized: false
}))

//Passport
app.use(passport.initialize());
app.use(passport.session())

//Set path
//1. Styling and Bootstrap
app.use('/css', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')));
app.use('/js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')));
app.use('/js', express.static(path.join(__dirname, 'node_modules/jquery/dist')));

//2. Assets
app.use('/assets', express.static(path.join(__dirname, 'assets')));

//3. ImageLoc
app.use('/image', express.static(path.join(__dirname, 'assets/img_content')))

//4. Template
app.use('/template', express.static(path.join(__dirname, 'views/template')))

//5. Favico
app.use('/favicon.ico', express.static(path.join(__dirname, '/assets/img_app/favicon.ico')))

//Set Default Render Engine
app.set('view engine', 'ejs')

//Buat menangkap JSON yang dikirim di req.body
app.use(express.urlencoded({
    extended: true
}))

//Modules
app.use(require('./globalRoutes')); // Routes
require('./dbConfig') // Database Config

//404 Custom Redirect
app.use(function(req, res) {
    res.status(404)
    res.send('Halaman tidak ditemukan!')
})