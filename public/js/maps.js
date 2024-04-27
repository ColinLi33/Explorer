const mapElement = document.getElementById('map');
const pointsData = mapElement.getAttribute('data-points');
const points = JSON.parse(pointsData);

var map = L.map('map').setView([points[0].latitude, points[0].longitude], 14); // Default center and zoom level
map.getRenderer(map).options.padding = 100;
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    noWrap: true,
    dragging: true
}).addTo(map);
var worldPolygon = turf.polygon([[[-90, -180], [-90, 180], [90, 180], [90, -180], [-90, -180]]]);

var line = turf.lineString(points.map(point => [point.latitude, point.longitude]));
var buffered = turf.buffer(line, 0.20); // Adjust the buffer size as needed
worldPolygon = turf.difference(worldPolygon, buffered);
var resultPolygon = L.polygon(worldPolygon.geometry.coordinates, {
    color: 'black',
    fillColor: 'black',
    fillOpacity: 0.85
}).addTo(map);