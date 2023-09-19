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
    //set up DB if needed
	async initialize() {
		await this.connect();
		// Create LocationData table if it doesn't exist
		await this.query(`
			CREATE TABLE IF NOT EXISTS LocationData (
				location_id INT AUTO_INCREMENT PRIMARY KEY,
				person_name VARCHAR(255),
				location POINT SRID 4326,
				timestamp INT
			)
		`);

		// Perform other initialization tasks here
	}
    //insert location data into DB
    async insertLocationData(personName, latitude, longitude, timestamp) {
        // Create a valid Point geometry with SRID 4326
        const point = `POINT(${latitude} ${longitude})`;
        
        // Convert 50 feet to meters (1 meter = 3.28084 feet)
        const thresholdMeters = 50 / 3.28084;

        //check if there is an existing point for the person within 50 feet
        const existingPoint = await this.query(
            'SELECT location_id FROM LocationData WHERE person_name = ? AND ST_Distance_Sphere(location, ST_GeomFromText(?, 4326)) < ?',
            [personName, point, thresholdMeters]
        );
        
        if (existingPoint.length > 0) {
            // console.log("existing point")
            // If there's an existing point, update the timestamp
            await this.query('UPDATE LocationData SET timestamp = ? WHERE location_id = ?', 
            [timestamp, existingPoint[0].location_id]);
        } else {
            // If there's no existing point within 50 feet, insert a new row
            console.log('no existing point', personName, latitude, longitude, timestamp)
            await this.query('INSERT INTO LocationData (person_name, location, timestamp) VALUES (?, ST_GeomFromText(?, 4326), ?)', 
            [personName, point, timestamp]);
        }
    }

	async getLocationData() {
		// Retrieve Point data as text with SRID
		const results = await this.query('SELECT *, AsText(location) AS location_text FROM LocationData');
		return results.map((row) => {
			const locationText = row.location_text;
			// Parse locationText to extract latitude and longitude if needed
			return {
				...row,
				latitude: parsedLatitude,
				longitude: parsedLongitude,
			};
		});
	}

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
