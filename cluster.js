class Cluster {
    constructor(maxDistanceKm = 0.03, minPoints = 1) {
        this.maxDistanceKm = maxDistanceKm; //max distance between points
        this.minPoints = minPoints; //min points for cluster
        this.gridSize = 0.001; //grid cell size for spatial grid
    }
    calculateDistance(lat1, lon1, lat2, lon2) { //haversine formula
        const R = 6371; //earth radius KM
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    createSpatialGrid(points) {
        const grid = new Map();
        points.forEach((point, index) => {
            const gridX = Math.floor(point.longitude / this.gridSize);
            const gridY = Math.floor(point.latitude / this.gridSize);
            const key = `${gridX},${gridY}`;
            
            if (!grid.has(key)) {
                grid.set(key, []);
            }
            grid.get(key).push(index);
        });
        return grid;
    }

    getNeighboringCells(pointX, pointY){
        const neighbors = [];
        for(let x = -1; x <= 1; x++){
            for(let y = -1; y <= 1; y++){
                neighbors.push(`${pointX + x},${pointY + y}`);
            }
        }
        return neighbors;
    }

    findNeighbors(points, pointIndex, grid){
        const neighbors = [];
        const currPoint = points[pointIndex];

        const gridX = Math.floor(currPoint.longitude / this.gridSize);
        const gridY = Math.floor(currPoint.latitude / this.gridSize);

        const neighborCells = this.getNeighboringCells(gridX, gridY);

        for(const cell of neighborCells){
            const cellPoints = grid.get(cell);
            if(!cellPoints){
                continue;
            }

            for(const p of cellPoints){
                if(p === pointIndex){
                    continue;
                }

                const distance = this.calculateDistance(currPoint.latitude, currPoint.longitude, points[p].latitude, points[p].longitude);
                if(distance <= this.maxDistanceKm){
                    neighbors.push(p);
                }
            }
        }
        return neighbors;
    }

    cluster(points){
        if(!points || points.length === 0){
            return [];
        }

        const clusters = [];
        const visited = new Set();
        const clustered = new Set();

        const spatialGrid = this.createSpatialGrid(points);

        for(let i = 0; i < points.length; i++){
            if(visited.has(i)){
                continue;
            }

            visited.add(i);
            const neighbors = this.findNeighbors(points, i, spatialGrid);

            if(neighbors.length < this.minPoints - 1){
                continue;
            }

            const cluster = [i];
            clustered.add(i);

            let j = 0;
            while(j < neighbors.length){
                const neighborIndex = neighbors[j];
                if(!visited.has(neighborIndex)){
                    visited.add(neighborIndex);
                    const neighborNeighbors = this.findNeighbors(points, neighborIndex, spatialGrid);

                    if(neighborNeighbors.length >= this.minPoints - 1){
                        for(const nn of neighborNeighbors){
                            if(!neighbors.includes(nn)){
                                neighbors.push(nn);
                            }
                        }
                    }
                }
                if(!clustered.has(neighborIndex)){
                    cluster.push(neighborIndex);
                    clustered.add(neighborIndex);
                }
                j++;
            }
            clusters.push(cluster);
        }
        return clusters;
    }

    calculateCenter(points, clusterIndices) {
        let totalLat = 0;
        let totalLng = 0;
        
        for (const index of clusterIndices) {
            totalLat += points[index].latitude;
            totalLng += points[index].longitude;
        }
        
        return {
            latitude: totalLat / clusterIndices.length,
            longitude: totalLng / clusterIndices.length,
            pointCount: clusterIndices.length
        };
    }

    clusterPoints(points) {
        const clusters = this.cluster(points);
        const result = [];
        
        for (const cluster of clusters) {
            const centroid = this.calculateCenter(points, cluster);
            result.push(centroid);
        }
        
        return result;
    }
}

async function clusterUserLocations(username, db) {
    try {
        console.log(`Clustering: ${username}`)
        const strPoints = await db.query(
            'SELECT latitude, longitude FROM LocationData WHERE username = ? ORDER BY timestamp',
            [username]
        );

        const points = strPoints.map(point => ({
            latitude: parseFloat(point.latitude),
            longitude: parseFloat(point.longitude)
        }));
        
        if (points.length === 0) {
            console.log(`No location data found for user: ${username}`);
            return;
        }
        
        const clusterer = new Cluster(0.03, 1); // 30m radius, min 1 point
        
        const clusters = clusterer.clusterPoints(points);
        
        if (clusters.length === 0) {
            console.log(`No clusters found for user: ${username}. Try adjusting clustering parameters.`);
            return;
        }
        
        console.log(`Found ${clusters.length} clusters for user: ${username}`);
        
        await db.query(
            'DELETE FROM UserClusters WHERE username = ?',
            [username]
        );
        
        const clusterValues = clusters.map(cluster => [
            username, cluster.latitude, cluster.longitude, cluster.pointCount
        ]);

        await db.query(
            'INSERT INTO UserClusters (username, centroid_lat, centroid_lng, point_count) VALUES ?',
            [clusterValues]
        );

        await db.query(
            'UPDATE Users SET clusters_dirty = FALSE, last_cluster_update = CURRENT_TIMESTAMP() WHERE username = ?',
            [username]
        );

        
        console.log(`Successfully inserted ${clusters.length} clusters for user: ${username}`);
    } catch (error) {
        console.error('Error clustering user locations:', error);
        throw error;
    }
}

module.exports = {
    Cluster,
    clusterUserLocations
};