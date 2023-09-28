let map;
const mapElement = document.getElementById('map');
const pointsData = mapElement.getAttribute('data-points');
const points = JSON.parse(pointsData);
const polygons = [];

async function initMap() {
    if (typeof google === 'undefined') {
        console.error('Google Maps API failed to load.');
        return;
    }

    const { Map, LatLngBounds, LatLng, Polygon} = google.maps;
    map = new Map(document.getElementById('map'), {
        center: { lat: 32.8675441, lng: -117.25350029999998 },
        zoom: 13,
    });

    const worldPolygons = [
        //west
        [
            { lat: 90, lng: -180 }, // NW
            { lat: 90, lng: 0 },    // NE
            { lat: -90, lng: 0 },   // SE
            { lat: -90, lng: -180 },// SW
        ],
        //east
        [
            { lat: 90, lng: 0 },    // NW
            { lat: 90, lng: 180 },  // NE
            { lat: -90, lng: 180 }, // SE
            { lat: -90, lng: 0 },   // SW
        ],
    ];

    // Create polygons and set their properties
    worldPolygons.forEach(coords => {
        const polygon = new google.maps.Polygon({
            paths: coords,
            strokeColor: "#000000", 
            strokeOpacity: 0,
            fillColor: "#000000", 
            fillOpacity: 0.5,     
            map: map,
        });
    });

    //Create polygon for each point
    points.forEach(point => {
        const pointPolygon = new Polygon({
            paths: [
                new LatLng(point.latitude - 0.001, point.longitude - 0.001),
                new LatLng(point.latitude + 0.001, point.longitude - 0.001),
                new LatLng(point.latitude + 0.001, point.longitude + 0.001),
                new LatLng(point.latitude - 0.001, point.longitude + 0.001)
            ],
            strokeColor: '#000000',
            strokeOpacity: 1,
            fillColor: '#FFFFFF',
            fillOpacity: .3,
        });
        polygons.push(pointPolygon);
    });

    //event listener to update the polygons when map is moved or zoomed
    map.addListener('bounds_changed', updatePolygons);
    map.addListener('idle', updatePolygons);
}


function polyOnMap(map, polygon) {
    const mapBounds = map.getBounds();
    const polygonPaths = polygon.getPaths().getAt(0); 

    for (let i = 0; i < polygonPaths.getLength(); i++) {
        if (mapBounds.contains(polygonPaths.getAt(i))) {
            return true; // Polygon intersects with the map bounds
        }
    }
    return false;
}

// Show polygons within the current map bounds
function updatePolygons() {
    polygons.forEach(pointPolygon => {
        if (polyOnMap(map, pointPolygon)) {
            pointPolygon.setMap(map); // Show on map
        } else {
            pointPolygon.setMap(null); // Remove from map
        }
    });
}

// Initialize Google Maps when the page is loaded
window.onload = function () {
    initMap();
};
