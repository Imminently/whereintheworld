import maplibregl, {
  type GeoJSONSource,
  type MapMouseEvent,
  type Marker,
} from "maplibre-gl";
import type { ReactElement } from "react";
import { useEffect, useRef } from "react";
import { clientConfig } from "../lib/config";
import {
  formatCoordinates,
  getShortestMapLineCoordinates,
  mapClickToCoordinates,
} from "../lib/mapLogic";
import type { Coordinates } from "../types";

interface GameMapProps {
  label: string;
  selectedCoordinates: Coordinates | null;
  revealedCoordinates?: Coordinates | null;
  disabled?: boolean;
  onSelect?: (coordinates: Coordinates) => void;
}

interface RevealLineData {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, never>;
    geometry: {
      type: "LineString";
      coordinates: [[number, number], [number, number]];
    };
  }>;
}

const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 1.35;
const REVEAL_LINE_SOURCE_ID = "guess-answer-connection";
const REVEAL_LINE_CASING_LAYER_ID = "guess-answer-connection-casing";
const REVEAL_LINE_LAYER_ID = "guess-answer-connection-line";
const REVEAL_FIT_PADDING_PX = 76;
const REVEAL_MAX_ZOOM = 5;

/** Interactive MapLibre map used for host answer selection and player guesses. */
export function GameMap({
  label,
  selectedCoordinates,
  revealedCoordinates = null,
  disabled = false,
  onSelect,
}: GameMapProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selectedMarkerRef = useRef<Marker | null>(null);
  const revealedMarkerRef = useRef<Marker | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || mapRef.current !== null) {
      return;
    }

    const map = new maplibregl.Map({
      container,
      style: clientConfig.mapStyleUrl,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: false },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || disabled || onSelect === undefined) {
      return;
    }

    const handleClick = (event: MapMouseEvent): void => {
      onSelect(mapClickToCoordinates(event));
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [disabled, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null) {
      return;
    }

    if (selectedCoordinates === null) {
      selectedMarkerRef.current?.remove();
      selectedMarkerRef.current = null;
      return;
    }

    const lngLat: [number, number] = [
      selectedCoordinates.longitude,
      selectedCoordinates.latitude,
    ];

    if (selectedMarkerRef.current === null) {
      selectedMarkerRef.current = new maplibregl.Marker({ color: "#2fc8b0" })
        .setLngLat(lngLat)
        .addTo(map);
    } else {
      selectedMarkerRef.current.setLngLat(lngLat);
    }
  }, [selectedCoordinates]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null) {
      return;
    }

    if (revealedCoordinates === null) {
      revealedMarkerRef.current?.remove();
      revealedMarkerRef.current = null;
      return;
    }

    const lngLat: [number, number] = [
      revealedCoordinates.longitude,
      revealedCoordinates.latitude,
    ];

    if (revealedMarkerRef.current === null) {
      revealedMarkerRef.current = new maplibregl.Marker({ color: "#ff7d66" })
        .setLngLat(lngLat)
        .addTo(map);
    } else {
      revealedMarkerRef.current.setLngLat(lngLat);
    }
  }, [revealedCoordinates]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null) {
      return;
    }

    const updateRevealConnection = (): void => {
      const lineCoordinates =
        selectedCoordinates === null || revealedCoordinates === null
          ? null
          : getShortestMapLineCoordinates(selectedCoordinates, revealedCoordinates);
      const sourceData: RevealLineData =
        lineCoordinates === null
          ? { type: "FeatureCollection", features: [] }
          : {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "LineString",
                    coordinates: lineCoordinates,
                  },
                },
              ],
            };

      if (map.getSource(REVEAL_LINE_SOURCE_ID) === undefined) {
        map.addSource(REVEAL_LINE_SOURCE_ID, {
          type: "geojson",
          data: sourceData,
        });
      } else {
        const source = map.getSource(REVEAL_LINE_SOURCE_ID) as GeoJSONSource;
        source.setData(sourceData);
      }

      if (map.getLayer(REVEAL_LINE_CASING_LAYER_ID) === undefined) {
        map.addLayer({
          id: REVEAL_LINE_CASING_LAYER_ID,
          type: "line",
          source: REVEAL_LINE_SOURCE_ID,
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#ffffff",
            "line-opacity": 0.85,
            "line-width": 7,
          },
        });
      }

      if (map.getLayer(REVEAL_LINE_LAYER_ID) === undefined) {
        map.addLayer({
          id: REVEAL_LINE_LAYER_ID,
          type: "line",
          source: REVEAL_LINE_SOURCE_ID,
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#168f83",
            "line-dasharray": [2, 1.4],
            "line-opacity": 0.95,
            "line-width": 3.5,
          },
        });
      }

      if (lineCoordinates !== null) {
        map.fitBounds(lineCoordinates, {
          padding: REVEAL_FIT_PADDING_PX,
          maxZoom: REVEAL_MAX_ZOOM,
          duration: 900,
        });
      }
    };

    if (map.isStyleLoaded() === true) {
      updateRevealConnection();
      return;
    }

    map.on("load", updateRevealConnection);
    return () => {
      map.off("load", updateRevealConnection);
    };
  }, [revealedCoordinates, selectedCoordinates]);

  return (
    <div className="map-block">
      <div
        ref={containerRef}
        className="map-container"
        role="application"
        aria-label={label}
      />
      <div className="map-meta">
        <span>{selectedCoordinates === null ? "No pin selected" : formatCoordinates(selectedCoordinates)}</span>
        {revealedCoordinates !== null ? (
          <span className="answer-pin">
            <span className="distance-line-swatch" aria-hidden="true" />
            Answer {formatCoordinates(revealedCoordinates)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
