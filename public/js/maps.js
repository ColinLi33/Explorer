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
        center: { lat: points[0].latitude, lng: points[0].longitude },
        zoom: 13,
    });
    addMarkers();
}
async function addMarkers(){
    for (var i = 0; i < points.length; i++) {
        addMarker(points[i]);
    }
}

async function addMarker(point){
    let marker = new google.maps.Marker({
        position: {lat: point.latitude, lng: point.longitude},
        map: map
    });

    var relativeTime = moment(point.timestamp * 1000).fromNow(); // Convert timestamp to milliseconds

    // Create an info window to display relative time when hovering over the marker
    var infowindow = new google.maps.InfoWindow({
        content: 'Last seen: ' + relativeTime
    });

    // Add event listener to display info window on marker hover
    marker.addListener('mouseover', function() {
        infowindow.open(map, marker);
    });

    // Close info window on marker mouseout (optional)
    marker.addListener('mouseout', function() {
        infowindow.close();
    });
}


    //figure out how to make polygon to cover world here

    //Create polygon for each point
//     points.forEach(point => {
//         const pointPolygon = new Polygon({
//             paths: [
//                 new LatLng(point.latitude - 0.001, point.longitude - 0.001),
//                 new LatLng(point.latitude + 0.001, point.longitude - 0.001),
//                 new LatLng(point.latitude + 0.001, point.longitude + 0.001),
//                 new LatLng(point.latitude - 0.001, point.longitude + 0.001)
//             ],
//             strokeColor: '#000000',
//             strokeOpacity: 1,
//             fillColor: '#FFFFFF',
//             fillOpacity: .3,
//         });
//         polygons.push(pointPolygon);
//     });

//     //event listener to update the polygons when map is moved or zoomed
//     map.addListener('bounds_changed', updatePolygons);
//     map.addListener('idle', updatePolygons);
// }


// function polyOnMap(map, polygon) {
//     const mapBounds = map.getBounds();
//     const polygonPaths = polygon.getPaths().getAt(0); 

//     for (let i = 0; i < polygonPaths.getLength(); i++) {
//         if (mapBounds.contains(polygonPaths.getAt(i))) {
//             return true; // Polygon intersects with the map bounds
//         }
//     }
//     return false;
// }

// // Show polygons within the current map bounds
// function updatePolygons() {
//     polygons.forEach(pointPolygon => {
//         if (polyOnMap(map, pointPolygon)) {
//             pointPolygon.setMap(map); // Show on map
//         } else {
//             pointPolygon.setMap(null); // Remove from map
//         }
//     });
// }

// Initialize Google Maps when the page is loaded
window.onload = function () {
    initMap();
};
