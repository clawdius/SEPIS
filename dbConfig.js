const path = require('path');

const database = require('sqlite3').verbose();
const dbLoc = path.join(__dirname + '/global_database.db');

const db = new database.Database(dbLoc, database.OPEN_READWRITE, (err) => {
    if (err)
        throw err;
})

module.exports = db;