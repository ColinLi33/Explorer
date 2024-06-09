const express = require('express');
require('dotenv').config();
const Life360 = require('./life360');
const Database = require('./db')
const densityClustering = require('density-clustering');

const port = 80;
const app = express();
app.use(express.static('public'));
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
        const points = await log.db.getAllData(personId);

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

class Logger{ 
    constructor(dbConfig, lifeToken, lifeUsername, lifePassword){ 
        this.db = new Database(dbConfig); 
        this.life360Client = new Life360(lifeToken, lifeUsername, lifePassword);
        this.circleCheck = 0;
        this.circles = null;
        this.circle = null;
    }; 

    //get list of circles for Life360 Client
    async getCircles(){ 
        this.circles = await this.life360Client.getCircles(); 
    } 
    //get specific circle data 
    async getCircle(indexNum){ 
        this.circle = await this.life360Client.getCircle(this.circles[indexNum]['id']); 
    } 
    
    //get memberDate from circle
    async getMembers(){
        try{
            if(this.circles == null || this.circleCheck % 1000 == 0){
                await this.getCircles();
            }
            await this.getCircle(0);
            this.circleCheck++;
            if(this.circleCheck > 1000){
                this.circleCheck = 0;
            }
            if(this.circle != null && this.circle['members'] != null){
                return this.circle['members'];
            } else {
                return [];
            }
        } catch(error){
            console.error("ERROR GETTING MEMBERS:", error);
            return [];
        }
    }
        //log location data into db
        async logData(){
            const members = await this.getMembers();
            for(let i = 0; i < members.length; i++){
                const name =  members[i]['firstName'] + members[i]['lastName'];
                if(members[i]['location'] != null){
                    const lat = members[i]['location']['latitude'];
                    const long = members[i]['location']['longitude'];
                    const timestamp = members[i]['location']['timestamp'];
                    try {
                        // Insert location data into the database
                        await this.db.insertLocationData(name, lat, long, timestamp);
                        if(this.circleCheck % 100 == 0){
                        console.log("Logged data")
                    }
                } catch(error){
                    console.error('Error inserting location data:', error);
                }
            }
        }
    }
    //start interval to log data
    startInterval(breakTime){
        this.intervalId = setInterval(() => this.logData(), breakTime);
    }
    
    //stop interval to log data
    stopInterval(){
        clearInterval(this.intervalId);
    }
}

async function startServer() {
    try {
        if(await log.life360Client.authenticate()){
            log.startInterval(5 * 1000); // 5 seconds in between requests
        } else {
            process.exit(1);
        }
        app.listen(port, '0.0.0.0', () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch(error){
        console.error('Error initializing the database:', error);
    }
}
const log = new Logger(dbConfig, process.env.LIFETOKEN, process.env.LIFEUSERNAME, process.env.LIFEPASSWORD);
startServer();

