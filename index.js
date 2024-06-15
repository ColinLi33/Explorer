const express = require('express');
require('dotenv').config();
const Life360 = require('./life360');
const Database = require('./db')
const densityClustering = require('density-clustering');

const port = 80;
const app = express();
app.use(express.static('public'));
app.use(express.json());
app.set('view engine', 'ejs');

const dbConfig = {
    host: 'localhost',
    user: process.env.DBUSER,
    password: process.env.DBPASS,
    database: process.env.DBNAME,
};

app.get('/', async (req, res) => {
    try{
        // const people = await log.db.getAllPersonName();
        // res.render('home', {peopleList : people});
        //only put me on it for now
        res.render('home', {peopleList: ['ColinLi']})
    } catch(error){
        console.error(error);
    }
});

app.get('/map/:personId', async (req, res) => {
    const personId = req.params.personId;
    try {
        const points = await logger.db.getAllData(personId);

        const data = points.map(point => [point.latitude, point.longitude]);
        const dbscan = new densityClustering.DBSCAN();
        const clusters = dbscan.run(data, 0.0005, 1); // make 2nd param lower for more clusters

        const representativePoints = clusters.map(cluster => {
            const latitudes = cluster.map(index => points[index].latitude);
            const longitudes = cluster.map(index => points[index].longitude);
            const centroidLatitude = latitudes.reduce((a, b) => a + b) / latitudes.length;
            const centroidLongitude = longitudes.reduce((a, b) => a + b) / longitudes.length;
            return { latitude: centroidLatitude, longitude: centroidLongitude };
        });

        res.render('map', { pointList: representativePoints, name: personId });
    } catch (error) {
        console.error(error);
    }
});
/*
app.get('/debugupdate', (req, res) => {
    console.log("TESTING UPDATE")
    let data = {locations: []}
    const fakeData = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [ -117.237146, 32.8809435 ] },
        properties: {
            speed: 0,
            battery_state: 'unplugged',
            motion: [],
            timestamp: new Date().toISOString(),
            horizontal_accuracy: 6,
            speed_accuracy: 1,
            vertical_accuracy: 1,
            battery_level: 0.51,
            wifi: 'UCSD-PROTECTED',
            course: 228,
            device_id: '3333',
            altitude: 119,
            course_accuracy: 180
        }
    }
    data.locations.push(fakeData);

    for(let i = 0; i < data.locations.length; i++){
        const locData = data.locations[i];
        const deviceId = locData.properties.device_id
        const uid = locData.properties.unique_id;
        const timestamp = locData.properties.timestamp;
        const epochTime = new Date(timestamp).getTime() / 1000;
        const lat = locData.geometry.coordinates[1];
        const long = locData.geometry.coordinates[0];
        logger.logData(deviceId, uid, epochTime, lat, long);
    }
});
*/
app.post('/update', async (req, res) => {
    const data = req.body;
    if(data == null){
        res.status(200).send({"result": "ok"});
        return 
    }
    for(let i = 0; i < data.locations.length; i++){
        const locData = data.locations[i];
        const deviceId = locData.properties.device_id
        const uid = locData.properties.unique_id;
        const timestamp = locData.properties.timestamp;
        const epochTime = new Date(timestamp).getTime() / 1000;
        const lat = locData.geometry.coordinates[1];
        const long = locData.geometry.coordinates[0];
        logger.logData(deviceId, uid, epochTime, lat, long);
    }
    res.status(200).send({"result": "ok"});
});

app.get('/debug', (req, res) => {
    res.send(logger.lastInsert);
});

class Logger{ 
    constructor(dbConfig){ 
        this.db = new Database(dbConfig); 
        this.db.initialize();
        this.insertCounter = 0;
        this.lastInsert = null;
    }; 

    getNameFromId(devId){ //move this into the DB
        if(devId == 3333) //temporary solution for now
            return "ColinLi";
        else if(devId == 4444)
            return "JoshuaHidalgo";
        else if(devId == 5555)
            return "WillGreenwood";
        else 
            return null
    }

    //log location data into db
    async logData(deviceId, uid, timestamp, lat, long){
        let name = null;
        if(uid == null){
            name = this.getNameFromId(deviceId);
        } else {
            name = await this.db.getNameFromUID(uid)
            console.log(name)
        }
        if(name == null || name.length == 0){
            console.log("No name found for uid", uid);
            name = this.getNameFromId(deviceId);
            if(name == null){
                console.error("No name found for UID, devID", uid, deviceId);
                return;
            } else {
                await this.db.updateUser(uid, name);
                console.log("Updated user", uid, name)
            }
        }
        try {
            await this.db.insertLocationData(name, lat, long, timestamp);
            this.lastInsert = {name, lat, long, timestamp};
            this.insertCounter++;
            if(this.insertCounter >= 100){
                this.insertCounter = 0;
                console.log("Inserted data", name, lat, long, timestamp);
            }
        } catch(error){
            console.error('Error inserting location data:', error);
        }
    }
}

async function startServer() {
    try {
        app.listen(port, '0.0.0.0', () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch(error){
        console.error('Error initializing the database:', error);
    }
}
const logger = new Logger(dbConfig);
startServer();

