const mysql = require('mysql2');
const cluster = require('./cluster')

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
    
    async initialize() {
        await this.query(`
            CREATE TABLE IF NOT EXISTS LocationData (
                location_id INT AUTO_INCREMENT PRIMARY KEY,
                person_name VARCHAR(255),
                latitude DECIMAL(10, 8) NOT NULL,
                longitude DECIMAL(11, 8) NOT NULL,
                timestamp INT,
                INDEX personNameIndex (person_name),
                INDEX timestampIndex (timestamp),
                SPATIAL INDEX spatialIndex (location) /*!80003 INVISIBLE */
            )
        `);
        
        await this.query(`
            CREATE TABLE IF NOT EXISTS UserClusters (
                cluster_id INT AUTO_INCREMENT PRIMARY KEY,
                person_name VARCHAR(255),
                centroid_lat DECIMAL(10, 8) NOT NULL,
                centroid_lng DECIMAL(11, 8) NOT NULL,
                point_count INT DEFAULT 1,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX personNameIndex (person_name),
                INDEX lastUpdatedIndex (last_updated)
            )
        `);
        
        await this.query(`
            CREATE TABLE IF NOT EXISTS Users (
                id INT AUTO_INCREMENT PRIMARY KEY, 
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                public BOOLEAN DEFAULT FALSE,
                clusters_dirty BOOLEAN DEFAULT FALSE,
                last_cluster_update TIMESTAMP NULL,
                INDEX clustersIndex (clusters_dirty)
            )
        `);
    }
    
    async insertLocationData(personName, latitude, longitude, timestamp) {
        const thresholdMeters = 15; // 15 meters threshold
        
        const existingPoint = await this.query(`
            SELECT location_id, latitude, longitude,
                   (6371000 * acos(cos(radians(?)) * cos(radians(latitude)) * 
                   cos(radians(longitude) - radians(?)) + sin(radians(?)) * 
                   sin(radians(latitude)))) AS distance
            FROM LocationData 
            WHERE person_name = ? 
            HAVING distance < ?
            ORDER BY distance 
            LIMIT 1
        `, [latitude, longitude, latitude, personName, thresholdMeters]);
        
        if (existingPoint.length > 0) {
            await this.query(
                'UPDATE LocationData SET timestamp = ? WHERE location_id = ?', 
                [timestamp, existingPoint[0].location_id]
            );
        } else {
            await this.query(
                'INSERT INTO LocationData (person_name, latitude, longitude, timestamp) VALUES (?, ?, ?, ?)', 
                [personName, latitude, longitude, timestamp]
            );
        
            await this.markClustersAsDirty(personName);
        }
    }

       //batch insert multiple location points
    async insertLocationDataBatch(locationData) {
        if (locationData.length === 0) return;
        
        const placeholders = locationData.map(() => '(?, ?, ?, ?)').join(',');
        const values = locationData.map(item => [
            item.personName, 
            item.latitude, 
            item.longitude, 
            item.timestamp
        ]).flat();
        
        await this.query(
            `INSERT INTO LocationData (person_name, latitude, longitude, timestamp) VALUES ${placeholders}`,
            values
        );
        
        const uniqueUsers = [...new Set(locationData.map(item => item.personName))];
        for (const username of uniqueUsers) {
            await this.markClustersAsDirty(username);
        }
    }
    
    
    // Mark user clusters as needing regeneration
    async markClustersAsDirty(personName) {
        await this.query(
            'UPDATE Users SET clusters_dirty = TRUE WHERE username = ?',
            [personName]
        );
    }
    
    async getUserClusters(username) {
        //check if clusters need regeneration
        const user = await this.query(
            'SELECT clusters_dirty, last_cluster_update FROM Users WHERE username = ?',
            [username]
        );
        
        if (user.length === 0) return [];
        
        const shouldRegenerate = user[0].clusters_dirty || 
                               !user[0].last_cluster_update ||
                               (Date.now() - new Date(user[0].last_cluster_update).getTime()) > 24 * 60 * 60 * 1000; // 24 hours
        
        if (shouldRegenerate) {
            await this.regenerateClusters(username);
        }
        
        const clusters = await this.query(
            'SELECT centroid_lat as latitude, centroid_lng as longitude, point_count FROM UserClusters WHERE person_name = ?',
            [username]
        );
        
        return clusters.map(cluster => ({ //make sure they come as floats
            ...cluster,
            latitude: parseFloat(cluster.latitude),
            longitude: parseFloat(cluster.longitude)
        }));
    }
    
    async regenerateClusters(username) {
        await cluster.clusterUserLocations(username, this);
    }

    async regenerateAllClusters(){
        await cluster.clusterAllUsersLocations(this);
    }
    
    // Get raw location data
    async getAllData(name) {
        const results = await this.query(
            'SELECT latitude, longitude, timestamp FROM LocationData WHERE person_name = ? ORDER BY timestamp',
            [name]
        );
        return results;
    }
    
    async getUserStats(username) {
        const stats = await this.query(`
            SELECT 
                COUNT(*) as total_points,
                MIN(timestamp) as first_point,
                MAX(timestamp) as last_point,
                COUNT(DISTINCT DATE(FROM_UNIXTIME(timestamp))) as active_days
            FROM LocationData 
            WHERE person_name = ?
        `, [username]);
        
        return stats[0] || {};
    }
    
    async registerUser(username, hashedPassword) {
        const result = await this.query(
            'INSERT INTO Users (username, password) VALUES (?, ?)', 
            [username, hashedPassword]
        );
        return result.insertId;
    }
    
    async getUserByUsername(username) {
        const results = await this.query(
            'SELECT * FROM Users WHERE username = ?', 
            [username]
        );
        return results[0] || null;
    }
    
    async updateUserPrivacy(username, isPublic) {
        await this.query(
            'UPDATE Users SET public = ? WHERE username = ?', 
            [isPublic, username]
        );
    }
    
    async getAllPersonName() {
        const results = await this.query('SELECT DISTINCT person_name FROM LocationData');
        return results.map(item => item.person_name);
    }
}

module.exports = Database;