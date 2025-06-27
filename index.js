const express = require('express');
const http = require('http');
require('dotenv').config();
const Database = require('./db')
const densityClustering = require('density-clustering');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const logs = require('pino')(); //logger 
const https = require('https');
const fs = require('fs');
const port = 443

const isSecure = process.env.NODE_ENV === 'production'; //FOR SECURE COOKIES
const app = express();
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

const refreshTokenIfNeeded = (req, res, token) => {
    try {
        const decoded = jwt.verify(token, jwtSecret);
        const now = Date.now() / 1000;
        
        //if expires within a day, make a new one
        if (decoded.exp - now < 86400) {
            const newToken = jwt.sign(
                { userId: decoded.userId, username: decoded.username }, 
                jwtSecret, 
                { expiresIn: '7d' }
            );
            
            res.cookie('accessToken', newToken, { 
                httpOnly: true, 
                secure: isSecure,
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 //7 days
            });
            
            return { userId: decoded.userId, username: decoded.username };
        }
        
        return decoded;
    } catch (error) {
        return null;
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
        const decoded = refreshTokenIfNeeded(req, res, token);
        if (decoded) {
            req.userId = decoded.userId;
            req.username = decoded.username;
        }
    }
    next();
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

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password required' });
        }
        
        const user = await logger.db.getUserByUsername(username);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const accessToken = jwt.sign(
            { userId: user.id, username: user.username }, 
            jwtSecret, 
            { expiresIn: '7d' }
        );
        
        const refreshToken = jwt.sign(
            { userId: user.id, username: user.username }, 
            jwtSecret, 
            { expiresIn: '30d' }
        );
        
        res.cookie('accessToken', accessToken, { 
            httpOnly: true, 
            secure: isSecure,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 //7 days
        });
        
        res.cookie('refreshToken', refreshToken, { 
            httpOnly: true, 
            secure: isSecure, 
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 //30 days
        });
        
        res.json({ success: true, message: 'Login successful' });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/logout', (req, res) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Logged out successfully' });
});

app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password required' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }
        
        const existingUser = await logger.db.getUserByUsername(username);
        if (existingUser) {
            return res.status(409).json({ message: 'Username already exists' });
        }
        
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        const userId = await logger.db.registerUser(username, hashedPassword);
        if (!userId) {
            return res.status(500).json({ message: 'Failed to create user' });
        }
        
        const accessToken = jwt.sign(
            { userId: userId, username: username }, 
            jwtSecret, 
            { expiresIn: '7d' }
        );
        
        const refreshToken = jwt.sign(
            { userId: userId, username: username }, 
            jwtSecret, 
            { expiresIn: '30d' }
        );
        
        res.cookie('accessToken', accessToken, { 
            httpOnly: true, 
            secure: isSecure,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 //7 days
        });
        
        res.cookie('refreshToken', refreshToken, { 
            httpOnly: true, 
            secure: isSecure, 
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 //30 days
        });
        
        logs.info(`New user registered: ${username}`);
        res.json({ success: true, message: 'Registration successful' });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/register', (req, res) => {
    res.render('register');
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
                    //log them in with proper cookie settings
                    const accessToken = token;
                    const refreshToken = jwt.sign({ userId: decoded.userId, username: decoded.username }, jwtSecret, { expiresIn: '30d' });
                    
                    res.cookie('accessToken', accessToken, { 
                        httpOnly: true, 
                        secure: isSecure,
                        sameSite: 'strict',
                        maxAge: 7 * 24 * 60 * 60 * 1000 //7 days
                    });
                    
                    res.cookie('refreshToken', refreshToken, { 
                        httpOnly: true, 
                        secure: isSecure, 
                        sameSite: 'strict',
                        maxAge: 30 * 24 * 60 * 60 * 1000 //30 days
                    });
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

app.post('/update', async (req, res) => { //update location data
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
        if(process.env.SERVER === 'cloud'){
            const options = {
                key: fs.readFileSync('/etc/letsencrypt/live/colinli.me/privkey.pem'),
                cert: fs.readFileSync('/etc/letsencrypt/live/colinli.me/cert.pem'),
                ca: fs.readFileSync('/etc/letsencrypt/live/colinli.me/chain.pem'), // Optional
            };
            https.createServer(options, app).listen(port, '0.0.0.0', () => {
                console.log(`Server is running on Digital Ocean on port ${port}`);
            });
        } else {
            app.listen(3333, () => {
                console.log(`Server is running on local on port 3333`);
            });
        }
    } catch(error){
        console.error('Error initializing the server:', error);
    }
}
const logger = new Logger(dbConfig);
startServer();