const mysql = require('mysql2');

class Database {
    constructor(config) { 
	    this.config = config;
	    this.connection = mysql.createConnection(config);
    }
    //connect to db
	connect() {
		return new Promise((resolve, reject) => {
			this.connection.connect((err) => {
				if (err) {
					console.error('Error connecting to MySQL:', err);
					reject(err);
				} else {
					console.log('Connected to MySQL');
					resolve();
				}
			});
		});
	}
    disconnect() {
        return new Promise((resolve, reject) => {
            this.connection.end((err) => {
                if (err) {
                    console.error('Error disconnecting from MySQL:', err);
                    reject(err);
                } else {
                    console.log('Disconnected from MySQL');
                    resolve();
                }
            });
        });
    }

    //helper function
    query(sql, values = []) {
        return new Promise((resolve, reject) => {
            this.connection.query(sql, values, (err, results) => {
                if (err) {
                    console.error('Error executing query:', err);
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });
    }
    //set up DB if needed
	async initialize() {
        try {
            await this.connect();
            await this.query(`
                CREATE TABLE IF NOT EXISTS LocationData (
                    location_id INT AUTO_INCREMENT PRIMARY KEY,
                    person_name VARCHAR(255),
                    location POINT SRID 4326,
                    timestamp INT,
                    INDEX personNameIndex (person_name)
                )
            `);
            await this.query(`CREATE TABLE IF NOT EXISTS Users (id CHAR(36) PRIMARY KEY, person_name VARCHAR(255))`);
        } catch (err) {
            console.error('Database operation failed:', err);
        } finally {
            await this.disconnect();
        }
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

    async getNameFromUID(uid){
        const results = await this.query('SELECT person_name FROM Users WHERE id = ?', [uid]);
        if(results == null || results.length == 0){
            return null;
        }
        return results[0].person_name;
    }

    async updateUser(id, name){
        await this.query('INSERT INTO Users (id, person_name) VALUES (?, ?)', [id, name]);
    }
 
    //close db
	close() {
		this.connection.end((err) => {
			if (err) {
				console.error('Error closing the database:', err);
			} else {
				console.log('Database connection closed');
			}
		});
	}
}
module.exports = Database;
