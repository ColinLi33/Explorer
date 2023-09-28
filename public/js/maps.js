let map;
const mapElement = document.getElementById('map');
const pointsData = mapElement.getAttribute('data-points');
const points = JSON.parse(pointsData);

async function initMap() {
    // Check if the google object is defined
    if (typeof google === 'undefined') {
        console.error('Google Maps API failed to load.');
        return;
    }

    const { Map } = google.maps;
    map = new Map(document.getElementById('map'), {
        center: { lat: 32.8675441, lng: -117.25350029999998 },
        zoom: 13,
    });

    // Loop through the points data and add markers (VERY SLOW ATM)
    // points.forEach(point => {
    //     new google.maps.Marker({
    //         position: { lat: point.latitude, lng: point.longitude },
    //         map: map,
    //         title: `${point.personName}'s Location`,
    //     });
    // });
}

// Initialize Google Maps when the page is loaded
window.onload = function () {
    initMap();
};
