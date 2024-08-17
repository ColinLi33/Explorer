const express = require('express');
require('dotenv').config();
const Database = require('./db')
const densityClustering = require('density-clustering');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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
    connectionLimit: 15,
    waitForConnections: true,
    keepAliveInitialDelay: 10000,
    enableKeepAlive: true,
};

const jwtSecret = process.env.JWTSECRET;

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
        const clusters = dbscan.run(data, 0.00025, 1); // make 2nd param lower for more clusters

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

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    console.log("registering:", username, password);
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await logger.db.registerUser(username, hashedPassword);
        res.status(201).json({success: true, message: 'User registered successfully'});
    } catch (error) {
        console.error(error);
        if(error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({success: false, message: 'Username already exists'});
        }
        res.status(500).json({success: false, message: 'Error registering user'});
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log("logging in", username, password);
    try {
        const user = await logger.db.getUserByUsername(username);
        console.log(user);
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        const accessToken = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '1h' });
        const refreshToken = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '7d' }); // Refresh token valid for 7 days
        console.log("Login successful");
        res.json({userId: user.id, accessToken: accessToken, refreshToken: refreshToken });
    } catch (error) {
        console.error(error);
        res.status(500).json({success: false, message: 'Error logging in'});
    }
});

app.post('/refresh-token', (req, res) => {
    const { refreshToken } = req.body;
    console.log("refreshing token", refreshToken);
    if (!refreshToken) {
        return res.status(401).json({ message: 'Access denied' });
    }
    try {
        const decoded = jwt.verify(refreshToken, jwtSecret);
        const newAccessToken = jwt.sign({ userId: decoded.userId }, jwtSecret, { expiresIn: '1h' });
        const newRefreshToken = jwt.sign({ userId: decoded.userId }, jwtSecret, { expiresIn: '7d' }); 
        res.json({accessToken: newAccessToken, refreshToken: newRefreshToken});
    } catch (error) {
        res.status(401).json({ message: 'Invalid refresh token' });
    }
});

const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Access denied' });
    }
    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};


app.post('/update', authenticate, async (req, res) => {
    const data = req.body;
    if(data == null){
        res.status(200).send({"result": "ok"});
        return 
    }
    const username = data.username;
    const lat = data.location.coords.latitude;
    const long = data.location.coords.longitude;
    const timestamp = Math.floor(data.location.timestamp / 1000);
    result = await logger.logData(username, timestamp, lat, long);
    if(result){
        res.status(200).send({"result": "ok"});
    } else {
        res.status(500).send({"result": "error"});
    }
});

app.get('/debug', (req, res) => {
    res.send(logger.lastInsert);
});

app.get('/eds124b', (req, res) => {
    res.render('eds');
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
    async logData(username, timestamp, lat, long){
        try {
            await this.db.insertLocationData(username, lat, long, timestamp);
            this.lastInsert = {username, lat, long, timestamp};
            this.insertCounter++;
            if(this.insertCounter >= 100){
                this.insertCounter = 0;
                console.log("Inserted data", username, uid, lat, long, timestamp);
            }
            return true;
        } catch(error){
            console.error('Error inserting location data:', error);
            return false;
        }
    }
}

async function startServer() {
    try {
        app.listen(port, '192.168.1.145', () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch(error){
        console.error('Error initializing the database:', error);
    }
}
const logger = new Logger(dbConfig);
startServer();

