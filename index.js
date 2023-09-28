const express = require('express');
require('dotenv').config();
const Life360 = require('./life360');
const Database = require('./db')

const port = 3333;
const app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs');

const dbConfig = {
    host: 'localhost',
    user: process.env.DBUSER,
    password: process.env.DBPASS,
    database: process.env.DBNAME,
};

app.get('/', (req, res) => {
    const googlekey = process.env.GOOGLEMAPSKEY
    res.render('map', {googlekey});
});

app.get('/map/:personId', async (req, res) => {
    const personId = req.params.personId;
    const googlekey = process.env.GOOGLEMAPSKEY

    // Call the getPointsForPerson function to retrieve points from the database
    try{
        const points = await log.db.getAllData(personId);
        res.render('map', {key: googlekey, pointList : points, name: personId});
    } catch(error){
        console.error(error);
    }
});

class Logger{ 
    //initialize DB and Life360 Clients
    constructor(dbConfig, lifeToken, lifeUsername, lifePassword){ 
        this.db = new Database(dbConfig); 
        this.life360Client = new Life360(lifeToken, lifeUsername, lifePassword);
        this.circleCheck = 0;
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
            //TODO: check if this is needed
            // if(this.circleCheck % 50 == 0){
                await this.getCircles();
                // }
                await this.getCircle(0);
                this.circleCheck++;
                return this.circle['members'];
            } catch(error){
                console.error("ERROR GETTING MEMBERS:", error);
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
            log.startInterval(10 * 1000);
        } else {
            exit();
        }
        // Start the Express server
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch(error){
        console.error('Error initializing the database:', error);
    }
}
const log = new Logger(dbConfig, process.env.LIFETOKEN, process.env.LIFEUSERNAME, process.env.LIFEPASSWORD);
startServer();

