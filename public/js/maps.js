const mapElement = document.getElementById('map');
const pointsData = mapElement.getAttribute('data-points');
const points = JSON.parse(pointsData);

var map = L.map('map').setView([points[0].latitude, points[0].longitude], 14); // Default center and zoom level
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    noWrap: true
}).addTo(map);

var worldPolygon = turf.polygon([[[-90, -180], [-90, 180], [90, 180], [90, -180], [-90, -180]]]);

var visitedPolygons = points.map(function (point) {
    var turfPoint = turf.point([point.latitude, point.longitude]);
    var bufferedPolygon = turf.buffer(turfPoint, .75);
    // bufferedPolygon.properties = { timestamp: point.timestamp };
    return bufferedPolygon;
});


visitedPolygons.forEach(function (visitedPolygon) {
    worldPolygon = turf.difference(worldPolygon, visitedPolygon);
});

var resultPolygon = L.polygon(worldPolygon.geometry.coordinates, {
    color: 'black',
    fillColor: 'black',
    fillOpacity: 0.85
}).addTo(map);
