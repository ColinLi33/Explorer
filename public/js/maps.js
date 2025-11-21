const mapElement = document.getElementById('map');
const pointsData = mapElement.getAttribute('data-points');
const points = JSON.parse(pointsData);

Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzZjViMTkyZC03MjNlLTQ5NWMtYWVhYi1lM2EyNWVhZTBiNWUiLCJpZCI6MzYyNDA5LCJpYXQiOjE3NjM2OTMzMTF9._xqwTlJIDkfBqCLu2cLPNdttN_Q5tSBh2TUdt6zGzaQ';

const viewer = new Cesium.Viewer("map", {
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    vrButton: false,
    infoBox: false,
    selectionIndicator: false
});

viewer.scene.primitives.add(new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.RectangleGeometry({
            rectangle: Cesium.Rectangle.fromDegrees(-180.0, -90.0, 180.0, 90.0),
            vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT
        })
    }),
    appearance: new Cesium.EllipsoidSurfaceAppearance({
        material: Cesium.Material.fromType('Color', {
            color: new Cesium.Color(0.0, 0.0, 0.0, 0.8)
        })
    })
}));

try {
    const imageryLayer = viewer.imageryLayers.addImageryProvider(
        await Cesium.IonImageryProvider.fromAssetId(3830184),
    );
    await viewer.zoomTo(imageryLayer);
} catch (error) {
    console.log(error);
}

viewer.cesiumWidget.creditContainer.style.display = 'none';