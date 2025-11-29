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

// Remove default base layer (Satellite) so it doesn't obscure the road map
viewer.imageryLayers.removeAll();

// Spatial Index to speed up tile generation
class SpatialGrid {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    addSegment(p1, p2) {
        // Simple bounding box insertion
        const minLon = Math.min(p1.longitude, p2.longitude);
        const maxLon = Math.max(p1.longitude, p2.longitude);
        const minLat = Math.min(p1.latitude, p2.latitude);
        const maxLat = Math.max(p1.latitude, p2.latitude);

        const startX = Math.floor(minLon / this.cellSize);
        const endX = Math.floor(maxLon / this.cellSize);
        const startY = Math.floor(minLat / this.cellSize);
        const endY = Math.floor(maxLat / this.cellSize);

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const key = `${x},${y}`;
                if (!this.grid.has(key)) {
                    this.grid.set(key, []);
                }
                this.grid.get(key).push({ p1, p2 });
            }
        }
    }

    query(west, south, east, north) {
        const segments = [];
        const startX = Math.floor(west / this.cellSize);
        const endX = Math.floor(east / this.cellSize);
        const startY = Math.floor(south / this.cellSize);
        const endY = Math.floor(north / this.cellSize);

        const checkedKeys = new Set();

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const key = `${x},${y}`;
                if (this.grid.has(key) && !checkedKeys.has(key)) {
                    segments.push(...this.grid.get(key));
                    checkedKeys.add(key);
                }
            }
        }
        return segments;
    }
}

class FogImageryProvider {
    constructor(points) {
        this._tilingScheme = new Cesium.GeographicTilingScheme();
        this._tileWidth = 256;
        this._tileHeight = 256;
        this._grid = new SpatialGrid(1.0); // 1 degree grid cells

        // Pre-process points into segments and add to grid
        const maxDistance = 2.5; // km
        if (points.length > 0) {
            for (let i = 1; i < points.length; i++) {
                const p1 = points[i - 1];
                const p2 = points[i];
                const point1 = turf.point([p1.longitude, p1.latitude]);
                const point2 = turf.point([p2.longitude, p2.latitude]);
                const distance = turf.distance(point1, point2);

                if (distance <= maxDistance) {
                    this._grid.addSegment(p1, p2);
                }
            }
        }
    }

    get tileWidth() { return this._tileWidth; }
    get tileHeight() { return this._tileHeight; }
    get tilingScheme() { return this._tilingScheme; }
    get ready() { return true; }
    get rectangle() { return this._tilingScheme.rectangle; }
    get hasAlphaChannel() { return true; }

    requestImage(x, y, level) {
        const canvas = document.createElement('canvas');
        canvas.width = this._tileWidth;
        canvas.height = this._tileHeight;
        const ctx = canvas.getContext('2d');

        // Fill with opaque fog (black with alpha)
        // We use a dark color with 0.8 alpha.
        // Note: Cesium handles alpha blending.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, this._tileWidth, this._tileHeight);

        // Calculate tile bounds in degrees
        const rectangle = this._tilingScheme.tileXYToRectangle(x, y, level);
        const west = Cesium.Math.toDegrees(rectangle.west);
        const south = Cesium.Math.toDegrees(rectangle.south);
        const east = Cesium.Math.toDegrees(rectangle.east);
        const north = Cesium.Math.toDegrees(rectangle.north);

        // Get relevant segments
        // We query a slightly larger area to handle lines crossing edges
        const buffer = 0.1; // degrees buffer
        const segments = this._grid.query(west - buffer, south - buffer, east + buffer, north + buffer);

        if (segments.length === 0) {
            return Promise.resolve(canvas);
        }

        // Set up "erasing" mode
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)'; // Color doesn't matter, alpha does
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Adjust line width based on zoom level
        // We want a minimum pixel width (e.g. 10px) so it's not a blob when zoomed out.
        // We want a maximum pixel width (e.g. 100px) so it doesn't cover everything when zoomed in.
        // We want a target geographic width (e.g. 60m) so it stays substantial when zoomed in.
        // Meters per pixel at equator for level L ~= 40075017 / 512 / 2^L
        const metersPerPixel = 78271.5 / Math.pow(2, level);
        const targetWidthMeters = 60;
        const calculatedWidth = targetWidthMeters / metersPerPixel;
        
        // Clamp between 10px and 100px
        ctx.lineWidth = Math.min(80, Math.max(25, calculatedWidth));

        // Helper to project lat/lon to tile pixel coordinates
        const width = this._tileWidth;
        const height = this._tileHeight;
        
        function toPixel(lon, lat) {
            // Linear interpolation for Geographic projection
            const u = (lon - west) / (east - west);
            const v = (lat - south) / (north - south);
            return {
                x: u * width,
                y: (1 - v) * height // Flip Y because canvas 0 is top
            };
        }

        ctx.beginPath();
        for (const seg of segments) {
            const p1 = toPixel(seg.p1.longitude, seg.p1.latitude);
            const p2 = toPixel(seg.p2.longitude, seg.p2.latitude);
            
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
        }
        ctx.stroke();
        
        return Promise.resolve(canvas);
    }
}

// Add the fog layer
const fogProvider = new FogImageryProvider(points);
viewer.imageryLayers.addImageryProvider(fogProvider);

// Add Google Maps Base Layer
(async () => {
    try {
        const imageryLayer = viewer.imageryLayers.addImageryProvider(
            await Cesium.IonImageryProvider.fromAssetId(3830184),
        );
        // Move base layer to bottom
        viewer.imageryLayers.lowerToBottom(imageryLayer);
        
        await viewer.zoomTo(imageryLayer);
    } catch (error) {
        console.log(error);
    }
})();

viewer.cesiumWidget.creditContainer.style.display = 'none';