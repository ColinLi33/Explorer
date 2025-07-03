const express = require('express');
const http = require('http');
require('dotenv').config();
const Database = require('./db')
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
    connectionLimit: 20,
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

const authenticate = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.accessToken) {
        token = req.cookies.accessToken;
    }
    
    if (!token) {
        return res.status(401).json({ message: 'Access denied' });
    }
    
    const decoded = refreshTokenIfNeeded(req, res, token);
    
    if (!decoded) {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
    
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
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
        
        res.json({ 
            success: true, 
            message: 'Login successful',
            accessToken,
            refreshToken,
            userId: user.id
        });
        
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

app.get('/map/:username', optionalAuthenticate, async (req, res) => {
    const username = req.params.username;
    const token = req.query.token;
    
    try {
        let isOwner = false;
        if (token) {
            try {
                const decoded = jwt.verify(token, jwtSecret);
                if (decoded.username === username) {
                    isOwner = true;
                    const accessToken = token;
                    const refreshToken = jwt.sign(
                        { userId: decoded.userId, username: decoded.username }, 
                        jwtSecret, 
                        { expiresIn: '30d' }
                    );
                    
                    res.cookie('accessToken', accessToken, { 
                        httpOnly: true, 
                        secure: isSecure,
                        sameSite: 'strict',
                        maxAge: 7 * 24 * 60 * 60 * 1000
                    });
                    
                    res.cookie('refreshToken', refreshToken, { 
                        httpOnly: true, 
                        secure: isSecure, 
                        sameSite: 'strict',
                        maxAge: 30 * 24 * 60 * 60 * 1000
                    });
                }
            } catch (error) {
                // Invalid token, continue as non-owner
            }
        }
        
        const user = await logger.db.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const isPublic = user.public;
        isOwner = req.username === username;
        
        if (!isPublic && !isOwner) {
            return res.send('<script>alert("The map you tried to access is private."); window.location.href = "/";</script>');
        }
        
        let points;
        points = await logger.db.getUserClusters(username);
        
        const shareableLink = isPublic ? `${req.protocol}://${req.get('host')}/map/${username}` : '';
        
        const stats = await logger.db.getUserStats(username);
        
        res.render('map', { 
            pointList: points, 
            name: username, 
            isPublic: isPublic, 
            isOwner: isOwner, 
            shareableLink: shareableLink,
           // stats: stats
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/update', async (req, res) => {
    const data = req.body;
    if (!data) {
        return res.status(200).send({"result": "ok"});
    }
    
    const username = data.username;
    if (!username) {
        return res.status(400).send({"result": "error", "message": "Username required"});
    }
    
    logs.info(`User ${username} updating location data`);
    
    try {
        const locationData = [];
        
        if (Array.isArray(data.location) && data.location.length > 0) {
            //batch processing for multiple points
            for (const location of data.location) {
                locationData.push({
                    personName: username,
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    timestamp: Math.floor(location.timestamp / 1000)
                });
            }
            await logger.db.insertLocationDataBatch(locationData);
            
        } else if (data.location && data.location.coords) {
            //single point
            const lat = data.location.coords.latitude;
            const long = data.location.coords.longitude;
            const timestamp = Math.floor(data.location.timestamp / 1000);
            
            const result = await logger.logData(username, timestamp, lat, long);
            if (!result) {
                return res.status(500).send({"result": "error"});
            }
        }
        
        res.status(200).send({"result": "ok"});
        
    } catch (error) {
        console.error('Location update error:', error);
        res.status(500).send({"result": "error"});
    }
});

app.post('/regenerate-clusters', authenticate, async (req, res) => {
    try {
        await logger.db.regenerateClusters(req.username);
        res.json({ success: true, message: 'Clusters regenerated' });
    } catch (error) {
        console.error('Cluster regeneration error:', error);
        res.status(500).json({ message: 'Failed to regenerate clusters' });
    }
});

app.get('/stats/:username', optionalAuthenticate, async (req, res) => {
    const username = req.params.username;
    const isOwner = req.username === username;
    
    try {
        const user = await logger.db.getUserByUsername(username);
        if (!user || (!user.public && !isOwner)) {
            return res.status(404).json({ message: 'User not found or private' });
        }
        
        const stats = await logger.db.getUserStats(username);
        res.json(stats);
        
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
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

// setInterval(async () => { //recalculate clusters 
//     try {
//         const dirtyUsers = await logger.db.query(
//             'SELECT username FROM Users WHERE clusters_dirty = TRUE LIMIT 5'
//         );
        
//         for (const user of dirtyUsers) {
//             try {
//                 await logger.db.regenerateClusters(user.username);
//                 logs.info(`Background cluster regeneration completed for ${user.username}`);
//             } catch (error) {
//                 logs.error(`Background cluster regeneration failed for ${user.username}:`, error);
//             }
//         }
//     } catch (error) {
//         logs.error('Background cluster regeneration error:', error);
//     }
// }, 60 * 60 * 1000); //every one hour

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

            // const users = await logger.db.getAllPersonName()
            // for(const username of users){
            //     logger.db.regenerateClusters(username)
            // }
        } else {
            app.listen(3333, () => {
                console.log(`Server is running on local on port 3333`);
            });

            const users = await logger.db.getAllPersonName()
            for(const username of users){
                logger.db.regenerateClusters(username)
            }
        }
    } catch(error){
        console.error('Error initializing the server:', error);
    }
}
const logger = new Logger(dbConfig);
startServer();