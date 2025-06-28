const mapElement = document.getElementById('map');
const pointsData = mapElement.getAttribute('data-points');
const points = JSON.parse(pointsData);

// Initialize map
var map = L.map('map').setView([points[0].latitude, points[0].longitude], 14);
map.getRenderer(map).options.padding = 100;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    noWrap: true,
    dragging: true
}).addTo(map);


const maxDistance = 3.5; //max distance in km between 2 points
const bufferWidth = 0.2;

var segments = [];
var segment = [points[0]];

for (let i = 1; i < points.length; i++) {
    const point1 = turf.point([segment[segment.length - 1].longitude, segment[segment.length - 1].latitude]);
    const point2 = turf.point([points[i].longitude, points[i].latitude]);
    const distance = turf.distance(point1, point2);
    if (distance > maxDistance) {
        segments.push(segment);
        segment = [points[i]];
    } else {
        segment.push(points[i]);
    }
}
segments.push(segment);

let buffers = [];
segments.forEach(segment => {
    var buffered;
    if (segment.length > 1) {
        var line = turf.lineString(segment.map(point => [point.longitude, point.latitude]));
        buffered = turf.buffer(line, bufferWidth, { units: 'kilometers' });
    } else {
        var point = turf.point([segment[0].longitude, segment[0].latitude]);
        buffered = turf.buffer(point, bufferWidth, { units: 'kilometers' });
    }
    buffers.push(buffered);
});

let mergedBuffer = buffers[0];
for (let i = 1; i < buffers.length; i++) {
    mergedBuffer = turf.union(mergedBuffer, buffers[i]);
}

var holes = [];
if (mergedBuffer.geometry.type === "Polygon") {
    holes.push(mergedBuffer.geometry.coordinates[0]);
} else if (mergedBuffer.geometry.type === "MultiPolygon") {
    mergedBuffer.geometry.coordinates.forEach(poly => {
        holes.push(poly[0]);
    });
}

var outerRing = [
    [-360, -180],
    [360, -180],
    [360, 180],
    [-360, 180],
    [-360, -180]
];

var polygonWithHoles = {
    "type": "Polygon",
    "coordinates": [
        outerRing,
        ...holes
    ]
};

L.geoJSON(polygonWithHoles, {
    style: {
        color: 'black',
        fillColor: 'black',
        fillOpacity: 0.7,
        weight: 0
    }
}).addTo(map);