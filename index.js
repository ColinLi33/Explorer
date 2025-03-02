const express = require('express');
require('dotenv').config();
const Database = require('./db')
const densityClustering = require('density-clustering');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
const https = require('https');
const logs = require('pino')(); //logger 
let options;

const isSecure = process.env.NODE_ENV === 'production'; //FOR SECURE COOKIES

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(cookieParser());

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

const authenticate = (req, res, next) => { //need to be logged in to access this route
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.accessToken) {
        token = req.cookies.accessToken;
    }
    if (!token) {
        return res.status(401).json({ message: 'Access denied' });
    }
    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.userId = decoded.userId;
        req.username = decoded.username;
        next(); //go next
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

const optionalAuthenticate = (req, res, next) => { //dont need to be logged in to access this route
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.accessToken) {
        token = req.cookies.accessToken;
    }
    if (token) {
        try {
            const decoded = jwt.verify(token, jwtSecret);
            req.userId = decoded.userId;
            req.username = decoded.username;
        } catch (error) {
            //they are not logged in
        }
    }
    next(); //go next
};

app.get('/', optionalAuthenticate, async (req, res) => {
    try {
        const isAuthenticated = !!req.username; //if username exists
        dropdownList = [];
        if(isAuthenticated && req.username != 'ColinLi'){ //so theres not 2 colins
            dropdownList.push(req.username);
        }
        dropdownList.push('ColinLi');
        res.render('home', { peopleList: dropdownList, isAuthenticated: isAuthenticated, username: req.username });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/about', (req, res) => {
    res.render('about');
});

app.get('/map/:username', optionalAuthenticate, async (req, res) => { //goes to a persons map
    const username = req.params.username;
    const token = req.query.token;
    try {
        let isOwner = false;
        if (token) { //this means they pressed button in app
            try {
                const decoded = jwt.verify(token, jwtSecret);
                if (decoded.username === username) {
                    isOwner = true;
                    //log them in 
                    const accessToken = token;
                    const refreshToken = jwt.sign({ userId: decoded.userId, username: decoded.username }, jwtSecret, { expiresIn: '30d' });
                    res.cookie('accessToken', accessToken, { httpOnly: true, secure: isSecure });
                    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: isSecure, sameSite: 'strict' });
                }
            } catch (error) {
                //invalid token, so continue as a non owner of map
            }
        }
        const user = await logger.db.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const isPublic = user.public; 
        isOwner = req.username === username;
        if(!isPublic && !isOwner){ //send them back to the shadow realm
            return res.send('<script>alert("The map you tried to access is private."); window.location.href = "/";</script>');
        }
        const points = await logger.db.getAllData(username);

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

        const shareableLink = isPublic ? `${req.protocol}://${req.get('host')}/map/${username}` : '';

        res.render('map', { pointList: representativePoints, name: username, isPublic: isPublic, isOwner: isOwner, shareableLink: shareableLink });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/register', async (req, res) => { //register account
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        userId = await logger.db.registerUser(username, hashedPassword);
        const accessToken = jwt.sign({ userId: userId, username: username }, jwtSecret, { expiresIn: '1d' });
        const refreshToken = jwt.sign({ userId: userId, username: username }, jwtSecret, { expiresIn: '30d' }); // Refresh token valid for 7 days
        logs.info(`User ${username} registered`);
        res.cookie('accessToken', accessToken, { httpOnly: true, secure: isSecure});
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: isSecure, sameSite: 'strict' });
    } catch (error) {
        console.error(error);
        if(error.code === 'ER_DUP_ENTRY') {
            logs.info(`Username ${username} already exists`);
            return res.status(400).json({success: false, message: 'Username already exists'});
        }
        logs.error('Error registering user:', error);
        res.status(500).json({success: false, message: 'Error registering user'});
    }
});

app.post('/login', async (req, res) => { //login account
    const { username, password } = req.body;
    try {
        const user = await logger.db.getUserByUsername(username);
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        const accessToken = jwt.sign({ userId: user.id, username: user.username }, jwtSecret, { expiresIn: '1d' });
        const refreshToken = jwt.sign({ userId: user.id, username: user.username }, jwtSecret, { expiresIn: '30d' }); // Refresh token valid for 7 days
        logs.info(`User ${username} logged in`);
        res.cookie('accessToken', accessToken, { httpOnly: true, secure: isSecure});
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: isSecure, sameSite: 'strict' });
        res.json({success: true, userId: user.id, accessToken: accessToken, refreshToken: refreshToken });
    } catch (error) {
        console.error(error);
        logs.error('Error logging in:', error);
        res.status(500).json({success: false, message: 'Error logging in'});
    }
});

app.get('/logout', (req, res) => { //logout 
    logs.info(`User ${req.username} logged out`);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.sendStatus(200);
});

app.post('/refresh-token', (req, res) => { //refresh auth token given refresh token
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ message: 'Access denied' });
    }
    try {
        const decoded = jwt.verify(refreshToken, jwtSecret);
        const newAccessToken = jwt.sign({ userId: decoded.userId, username: decoded.username }, jwtSecret, { expiresIn: '1d' });
        const newRefreshToken = jwt.sign({ userId: decoded.userId, username: decoded.username }, jwtSecret, { expiresIn: '30d' }); 
        logs.info(`User ${decoded.username} refreshed token`);
        res.cookie('accessToken', newAccessToken, { httpOnly: true, secure: isSecure});
        res.cookie('refreshToken', newRefreshToken, { httpOnly: true, secure: isSecure, sameSite: 'strict' });
        res.json({accessToken: newAccessToken, refreshToken: newRefreshToken});
    } catch (error) {
        logs.error('Error refreshing token:', error);
        res.status(401).json({ message: 'Invalid refresh token' });
    }
});


app.post('/update', authenticate, async (req, res) => { //update location data
    const data = req.body;
    if(data == null){
        res.status(200).send({"result": "ok"});
        return 
    }
    const username = data.username;
    logs.info(`User ${username} updated location data`);
    if(data.location.length > 0){
        for (let i = 0; i < data.location.length; i++) {
            const lat = data.location[i].coords.latitude;
            const long = data.location[i].coords.longitude;
            const timestamp = Math.floor(data.location[i].timestamp / 1000);
            result = await logger.logData(username, timestamp, lat, long);
            if(!result){
                res.status(500).send({"result": "error"});
                return
            }
        }
    } else {
        const lat = data.location.coords.latitude;
        const long = data.location.coords.longitude;
        const timestamp = Math.floor(data.location.timestamp / 1000);
        result = await logger.logData(username, timestamp, lat, long);
        if(!result){
            res.status(500).send({"result": "error"});
            return
        }
    }
    res.status(200).send({"result": "ok"});
});

app.post('/updatePrivacy', authenticate, async (req, res) => { //update privacy setting on map
    const { isPublic } = req.body;
    const username = req.username;
    try {
        await logger.db.updateUserPrivacy(username, isPublic);
        logs.info(`User ${username} updated privacy setting to ${isPublic}`);
        res.json({ success: true });
    } catch (error) {
        logs.error('Error updating privacy setting:', error);
        res.status(500).json({ success: false, message: 'Error updating privacy setting' });
    }
});

class Logger{ 
    constructor(dbConfig){ 
        this.db = new Database(dbConfig); 
        this.db.initialize();
    }; 

    //log location data into db
    async logData(username, timestamp, lat, long){
        try {
            await this.db.insertLocationData(username, lat, long, timestamp);
            logs.info(`Location data inserted for ${username} at ${lat}, ${long}`);
            return true;
        } catch(error){
            console.error('Error inserting location data:', error);
            logs.error('Error inserting location data:', error);
            return false;
        }
    }
}

async function startServer() {
    try {
        if(process.env.SERVER === 'aws'){
            https.createServer(options, app).listen(443, '0.0.0.0', () => {
                console.log(`Server is running on Digital Ocean on port ${port}`);
            });
        } else {
            app.listen(3333, '192.168.1.145', () => {
                console.log(`Server is running on local on port ${port}`);
            });
        }
    } catch(error){
        console.error('Error initializing the database:', error);
    }
}
const logger = new Logger(dbConfig);
startServer();

