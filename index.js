const express = require('express');
require('dotenv').config();
const Life360 = require('./life360');
const Database = require('./db')

const port = 3333;
const app = express();
const dbConfig = {
    host: 'localhost',
    user: process.env.DBUSER,
    password: process.env.DBPASS,
    database: process.env.DBNAME,
};
const db = new Database(dbConfig);

app.get('/', (req, res) => {
    res.send('Server is running.');
});

//Function to initialize and connect to Life360 and get a list of memebrs in the circle
async function getMembers(){
    try{
        const life360Client = new Life360(process.env.LIFETOKEN, process.env.LIFEUSERNAME, process.env.LIFEPASSWORD);
        if(await life360Client.authenticate()){
            circles = await life360Client.getCircles();
            circleId = circles[0]['id']; //get first circleId since i only have 1
            circle = await life360Client.getCircle(circleId);
            members = circle['members'];
            return members;
        }
    
    } catch(error){
        console.error("ERROR SIGNING IN:", error);
    }
}

//Function to get location of all members of circle and push it to MySQL database
async function logData(members){
    for(let i = 0; i < members.length; i++){
        const name =  members[i]['firstName'] + members[i]['lastName'];
        if(members[i]['location'] != null){
            const lat = members[i]['location']['latitude'];
            const long = members[i]['location']['longitude'];
            const timestamp = members[i]['location']['timestamp'];
            console.log(name, lat, long ,timestamp)
            try {
                // Insert location data into the database
                await db.insertLocationData(name, lat, long, timestamp);
                console.log(`Logged ${name}'s location`)
                } catch(error){
                    console.error('Error inserting location data:', error);
            }
        }
    }
}

//start the MySQL database and start logging locations every 15 seconds
async function startServer() {
    try {
        // Initialize the database
        await db.initialize();
        members = await getMembers();
        // Start the Express server
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });

        //runs logoData every 30 seconds
        setInterval(function() {
            logData(members);
        }, 15 * 1000);
    } catch(error){
        console.error('Error initializing the database:', error);
    }
}

startServer();