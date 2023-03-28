from life360 import life360
from passwords import loginInfo
import sqlite3
import time
def getMembers():
    try:
        api = life360(authorization_token=authToken, username=username, password=password)
        if api.authenticate():
            circles =  api.get_circles()
            id = circles[0]['id']
            circle = api.get_circle(id)
            members = circle['members']
            return members
    except:
        return("Error signing in")
    
def logData(person,cursor): 
    position = {"lat": person['location']['latitude'], "long": person['location']['longitude'], 'time': person['location']['timestamp']}
    tableToInsert = person['firstName']
    dataToInsert = (position['lat'],position['long'],position['time'])
    sqlQuery = f"INSERT INTO {tableToInsert} (lat, long, timestamp) VALUES (?, ?, ?)"
    cursor.execute(sqlQuery, dataToInsert)

if __name__ == "__main__":
    username = loginInfo['username']
    password = loginInfo['password']
    authToken = loginInfo['authToken']
    db = sqlite3.connect('circle.db')
    cursor = db.cursor()
    members = getMembers()

    while (True):
        for person in members:
            logData(person, cursor)
            print("Inserted into", person['firstName'])
            db.commit()
        time.sleep(10)

