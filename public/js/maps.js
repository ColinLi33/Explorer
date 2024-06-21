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
const maxDistance = 2; //max distance in km between two points
var segments = [];
var segment = [points[0]];
for (let i = 1; i < points.length; i++) {
    const point1 = turf.point([segment[segment.length - 1].longitude, segment[segment.length - 1].latitude]); //last point in segment
    const point2 = turf.point([points[i].longitude, points[i].latitude]); //new point we are looking at
    const distance = turf.distance(point1, point2);

    if (distance > maxDistance) {
        segments.push(segment);
        segment = [points[i]];
    } else {
        segment.push(points[i]);
    }
}
segments.push(segment);
segments.forEach(segment => {
    if (segment.length > 1) {
        var line = turf.lineString(segment.map(point => [point.latitude, point.longitude]));
        var buffered = turf.buffer(line, 0.20); //how wide the line is 
        worldPolygon = turf.difference(worldPolygon, buffered);
    } else if(segment.length == 1) {  ///single point
        var point = turf.point([segment[0].latitude, segment[0].longitude]);
        var buffered = turf.buffer(point, 0.20); 
        worldPolygon = turf.difference(worldPolygon, buffered);
    }
});
var resultPolygon = L.polygon(worldPolygon.geometry.coordinates, {
    color: 'black',
    fillColor: 'black',
    fillOpacity: 0.85
}).addTo(map);