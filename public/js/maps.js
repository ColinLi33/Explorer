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

// Create a canvas to use as the alpha mask
function generateFogMask(points) {
    const canvas = document.createElement('canvas');
    canvas.width = 4096;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');

    // Fill with black (opaque fog)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw paths in white (transparent/revealed areas)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5; // Adjust for wider/narrower paths
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Helper to convert lat/lon to canvas coordinates
    function toCanvas(lon, lat) {
        const x = ((lon + 180) / 360) * canvas.width;
        const y = ((90 - lat) / 180) * canvas.height;
        return { x, y };
    }

    // Draw segments
    // We reuse the segment logic or just iterate points if they are ordered
    // Re-implementing the distance check here to ensure we don't draw lines across the world for jumps
    const maxDistance = 3.5; // km
    let currentPath = [];
    
    if (points.length > 0) {
        currentPath.push(points[0]);
        
        for (let i = 1; i < points.length; i++) {
            const p1 = points[i-1];
            const p2 = points[i];
            const point1 = turf.point([p1.longitude, p1.latitude]);
            const point2 = turf.point([p2.longitude, p2.latitude]);
            const distance = turf.distance(point1, point2);

            if (distance > maxDistance) {
                // End current path and draw it
                drawPath(ctx, currentPath, toCanvas);
                currentPath = [p2];
            } else {
                currentPath.push(p2);
            }
        }
        // Draw final path
        drawPath(ctx, currentPath, toCanvas);
    }

    return canvas;
}

function drawPath(ctx, path, toCanvas) {
    if (path.length < 1) return;
    
    ctx.beginPath();
    const start = toCanvas(path[0].longitude, path[0].latitude);
    ctx.moveTo(start.x, start.y);
    
    if (path.length === 1) {
        // Draw a dot for single points
        ctx.arc(start.x, start.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
    } else {
        for (let i = 1; i < path.length; i++) {
            const pt = toCanvas(path[i].longitude, path[i].latitude);
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
    }
}

const fogMaskCanvas = generateFogMask(points);

// Create a custom material that uses the canvas as a mask
const fogMaterial = new Cesium.Material({
    fabric: {
        type: 'FogMask',
        uniforms: {
            mask: fogMaskCanvas,
            color: new Cesium.Color(0.0, 0.0, 0.0, 0.8)
        },
        source: `
            czm_material czm_getMaterial(czm_materialInput materialInput) {
                czm_material material = czm_getDefaultMaterial(materialInput);
                
                // Sample the mask texture
                // The texture is white where we have been, black where we haven't.
                // We want alpha to be 0.0 where mask is white (1.0), and 0.8 where mask is black (0.0).
                
                // Use texture() for WebGL 2 / GLSL 3.00 ES compatibility
                vec4 maskColor = texture(mask, materialInput.st);
                float maskValue = maskColor.r; // Use red channel (it's grayscale)
                
                material.diffuse = color.rgb;
                material.alpha = color.a * (1.0 - maskValue);
                
                return material;
            }
        `
    },
    translucent: true
});

// Add the fog layer covering the entire globe
viewer.scene.primitives.add(new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.RectangleGeometry({
            rectangle: Cesium.Rectangle.fromDegrees(-180.0, -90.0, 180.0, 90.0),
            vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT
        })
    }),
    appearance: new Cesium.EllipsoidSurfaceAppearance({
        material: fogMaterial,
        aboveGround: true
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