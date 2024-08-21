const mysql = require('mysql2');

class Database {
    constructor(config) { 
	    this.config = config;
	    this.pool = mysql.createPool(config);
    }
    //helper function
    query(sql, values = []) {
        return new Promise((resolve, reject) => {
            this.pool.query(sql, values, (err, results) => {
                if (err) {
                    console.error('Error executing query:', err);
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });
    }
    closePool() {
        return new Promise((resolve, reject) => {
            this.pool.end((err) => {
                if (err) {
                    console.error('Error closing pool:', err);
                    reject(err);
                } else {
                    console.log('Connection pool closed');
                    resolve();
                }
            });
        });
    }
    //set up DB if needed
	async initialize() {
		await this.query(`
			CREATE TABLE IF NOT EXISTS LocationData (
				location_id INT AUTO_INCREMENT PRIMARY KEY,
				person_name VARCHAR(255),
				location POINT SRID 4326,
				timestamp INT,
                INDEX personNameIndex (person_name)
            )
		`);
        await this.query(`CREATE TABLE IF NOT EXISTS Users (
            id INT AUTO_INCREMENT PRIMARY KEY, 
            username VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            public BOOLEAN DEFAULT FALSE
            )
        `);
	}
    
    //insert location data into DB
    async insertLocationData(personName, latitude, longitude, timestamp) {
        const point = `POINT(${latitude} ${longitude})`;

        const thresholdMeters = 15 / 3.28084;

        //check if there is an existing point for the person within threshold 
        const existingPoint = await this.query(
            'SELECT location_id FROM LocationData WHERE person_name = ? AND ST_Distance_Sphere(location, ST_GeomFromText(?, 4326)) < ?',
            [personName, point, thresholdMeters]
        );
        
        if (existingPoint.length > 0) {
            // console.log("existing point")
            // If there's an existing point, update the timestamp
            // console.log('existing point', personName, latitude, longitude, timestamp)
            await this.query('UPDATE LocationData SET timestamp = ? WHERE location_id = ?', 
            [timestamp, existingPoint[0].location_id]);
        } else {
            // If there's no existing point within threshold, insert a new row
            console.log('no existing point', personName, latitude, longitude, timestamp)
            await this.query('INSERT INTO LocationData (person_name, location, timestamp) VALUES (?, ST_GeomFromText(?, 4326), ?)', 
            [personName, point, timestamp]);
        }
    }

    //get all data by name that is within a radius of currLat,currLong
	async getRelativeData(name, currLat, currLong, dist) {
        const point = `POINT(${latitude} ${longitude})`;
        const thresholdMeters = dist / 3.28084;
		
        //TODO: idk about this line
        const results = await this.query( 'SELECT location_id FROM LocationData WHERE person_name = ? AND ST_Distance_Sphere(location, ST_GeomFromText(?, 4326)) < ?',
        [name, point, thresholdMeters]);
        return results
	}

    //get every location point and timestamp by person
    async getAllData(name){
        const results = await this.query('SELECT ST_X(location) AS latitude, ST_Y(location) AS longitude, timestamp FROM LocationData WHERE person_name = ?', name);
        return results;
    }

    async getAllPersonName(){
        const results = await this.query('SELECT DISTINCT person_name FROM LocationData');
        const personNamesList = results.map(item => item.person_name);
        return personNamesList;
    }

    async registerUser(username, hashedPassword) {
        //users table has id, username, password
        const result = await this.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        return result.insertId;
    }
    
    async getUserByUsername(username) {
        const [rows] = await this.query('SELECT * FROM users WHERE username = ?', [username]);
        return rows;
    }

    async updateUserPrivacy(username, isPublic) {
        try {
            const result = await this.query('UPDATE users SET public = ? WHERE username = ?', [isPublic, username]);
        } catch (error) {
            throw error;
        }
    }

}
module.exports = Database;
