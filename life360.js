const axios = require('axios');

class Life360{
    baseUrl = 'https://api-cloudfront.life360.com:443/v3/'
    tokenUrl = 'oauth2/token.json';
    circlesUrl = 'circles.json';
    circleUrl = 'circles/';
    USER_AGENT = "com.life360.android.safetymapd"

    constructor(token=null, username=null, password=null){
        this.token = token
        this.username = username;
        this.password = password;
    }
    //make a get or post request with custom headers and parmas
    async makeRequest(url, params=null, method='GET', authHeader=null){
        let headers = {'Accept': 'application/json'};
        if(authHeader){
            headers = {
                'Accept': 'application/json', 
                'Authorization': authHeader, 
                'cache-control': 'no-cache', 
                "user-agent": this.USER_AGENT
            };
        }
        let res = null;
        if(method == 'GET'){
            try {
                const response = await axios.get(url, {headers: headers});
                res = response.data;
            } catch(error) {
                console.error('GET Request Failed');
                console.error('Error:', error.message);
            }
        } else if(method == 'POST'){
            try {
                const response = await axios.post(url, params, {headers: headers});
                res = response.data;
            } catch(error) {
                console.error('POST Request Failed');
                console.error('Error:', error.message);
            }
        }
        return res;
    }
    //log into Life360 and get token
    async authenticate(){
        const url = this.baseUrl + this.tokenUrl;
        const params = {
            'grant_type': 'password',
            'username': this.username,
            'password': this.password,
        };
        let authHeader = 'Basic ' + this.token
        const res = await this.makeRequest(url, params, 'POST', authHeader);
        
        try{
            this.token = res['access_token'];
            return true;
        } catch(error){
            console.error('AUTHENTICATION ERROR:', error.message);
            return false;
        }
    }
    //get list of circles for account
    async getCircles(){
        const url = this.baseUrl + this.circlesUrl;
        const authHeader = "bearer " + this.token;
        const res = await this.makeRequest(url, null, 'GET', authHeader);
        return res['circles'];
    }
    //get circle by circleID
    async getCircle(circleId){
        const url = this.baseUrl + this.circleUrl + circleId;
        const authHeader = "bearer " + this.token;
        const res = await this.makeRequest(url, null, 'GET', authHeader);
        return res;
    }
}
module.exports = Life360;