import 'leaflet';

declare module 'leaflet' {
    interface MarkerClusterGroupOptions {
        spiderfyOnMaxZoom?: boolean;
        disableClusteringAtZoom?: number;
        maxClusterRadius?: number;
        removeOutsideVisibleBounds?: boolean;
        animateAddingMarkers?: boolean;
        chunkedLoading?: boolean;
    }

    class MarkerClusterGroup extends FeatureGroup {
        addLayers(layers: Layer[]): this;
        removeLayers(layers: Layer[]): this;
    }

    function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup;
}

declare module 'leaflet.markercluster';
