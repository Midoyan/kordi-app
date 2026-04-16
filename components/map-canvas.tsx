"use client";

import type mapboxgl from "mapbox-gl";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type MapCanvasMarker = {
  id: string;
  coordinates: [number, number];
  createElement: () => HTMLElement;
  createPopupElement?: () => HTMLElement;
  hoverOpenDelayMs?: number;
  anchor?: "center" | "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  minVisibleZoom?: number;
  fullSizeZoom?: number;
  minScale?: number;
  minOpacity?: number;
};

export type MapCanvasLine = {
  id: string;
  coordinates: [number, number][];
  color?: string;
  width?: number;
  opacity?: number;
};

type MapCanvasProps = {
  accessToken?: string;
  className?: string;
  center?: [number, number];
  zoom?: number;
  bearing?: number;
  pitch?: number;
  styleUrl?: string;
  hideStyleAnnotations?: boolean;
  markers?: MapCanvasMarker[];
  lines?: MapCanvasLine[];
  missingTokenTitle?: string;
  missingTokenDetail?: ReactNode;
};

export function MapCanvas({
  accessToken = "",
  className,
  center = [13.413215, 52.521918],
  zoom = 12.8,
  bearing = 0,
  pitch = 0,
  styleUrl = "mapbox://styles/mapbox/light-v11",
  hideStyleAnnotations = true,
  markers = [],
  lines = [],
  missingTokenTitle = "Map unavailable without a Mapbox token",
  missingTokenDetail = "Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to render the interactive map canvas.",
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRefs = useRef<Array<{
    marker: mapboxgl.Marker;
    element: HTMLElement;
    popup: mapboxgl.Popup | null;
    definition: MapCanvasMarker;
    cleanup: (() => void) | null;
  }>>([]);
  const [mapReady, setMapReady] = useState(false);
  const hasMapboxToken = Boolean(accessToken.trim());

  useEffect(() => {
    if (!hasMapboxToken || !containerRef.current) {
      return;
    }

    let cancelled = false;

    async function setupMap() {
      const mapboxgl = (await import("mapbox-gl")).default;

      if (cancelled || !containerRef.current) {
        return;
      }

      mapboxgl.accessToken = accessToken;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: styleUrl,
        center,
        zoom,
        pitch,
        bearing,
        attributionControl: false,
      });

      mapRef.current = map;

      const markMapReady = () => {
        setMapReady(true);
      };

      if (map.isStyleLoaded()) {
        markMapReady();
      } else {
        map.once("load", markMapReady);
      }

      map.addControl(
        new mapboxgl.NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: true,
        }),
        "top-right",
      );
      map.addControl(new mapboxgl.FullscreenControl(), "top-right");
      map.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true,
          },
          trackUserLocation: true,
          showUserHeading: true,
        }),
        "top-right",
      );
      map.addControl(
        new mapboxgl.ScaleControl({
          maxWidth: 120,
          unit: "metric",
        }),
        "bottom-left",
      );
      map.addControl(
        new mapboxgl.AttributionControl({
          compact: true,
        }),
        "bottom-right",
      );

      if (hideStyleAnnotations) {
        const hideAnnotations = () => {
          const layers = map.getStyle().layers ?? [];

          for (const layer of layers) {
            if (layer.type === "symbol") {
              map.setLayoutProperty(layer.id, "visibility", "none");
            }
          }
        };

        map.on("load", hideAnnotations);
        map.on("styledata", hideAnnotations);
      }
    }

    setupMap();

    return () => {
      cancelled = true;
      for (const markerRef of markerRefs.current) {
        markerRef.cleanup?.();
        markerRef.popup?.remove();
        markerRef.marker.remove();
      }
      markerRefs.current = [];
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [accessToken, bearing, center, hasMapboxToken, hideStyleAnnotations, pitch, styleUrl, zoom]);

  useEffect(() => {
    if (!hasMapboxToken || !mapReady || !mapRef.current) {
      return;
    }

    let disposed = false;

    async function syncMarkers() {
      const mapboxgl = (await import("mapbox-gl")).default;

      if (disposed || !mapRef.current) {
        return;
      }

      const map = mapRef.current;

      for (const markerRef of markerRefs.current) {
        markerRef.cleanup?.();
        markerRef.popup?.remove();
        markerRef.marker.remove();
      }

      markerRefs.current = markers.map((markerDefinition) => {
        const element = markerDefinition.createElement();
        applyMarkerZoomStyle(element, markerDefinition, map.getZoom());

        const marker = new mapboxgl.Marker({
          element,
          anchor: markerDefinition.anchor ?? "bottom",
        })
          .setLngLat(markerDefinition.coordinates)
          .addTo(map);

        let popup: mapboxgl.Popup | null = null;
        let cleanup: (() => void) | null = null;

        if (markerDefinition.createPopupElement) {
          const popupElement = markerDefinition.createPopupElement();
          const hoverOpenDelayMs = markerDefinition.hoverOpenDelayMs ?? 0;
          let openTimeoutId: number | null = null;
          let leaveTimeoutId: number | null = null;

          popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 18,
            className: "map-cast-popup-shell",
          }).setDOMContent(popupElement);

          const clearOpenTimeout = () => {
            if (openTimeoutId !== null) {
              window.clearTimeout(openTimeoutId);
              openTimeoutId = null;
            }
          };

          const clearLeaveTimeout = () => {
            if (leaveTimeoutId !== null) {
              window.clearTimeout(leaveTimeoutId);
              leaveTimeoutId = null;
            }
          };

          const showPopup = () => {
            clearLeaveTimeout();
            clearOpenTimeout();

            if (!popup) {
              return;
            }

            if (!popup.isOpen()) {
              popup.setLngLat(markerDefinition.coordinates).addTo(map);
            }
          };

          const openPopup = () => {
            clearLeaveTimeout();
            clearOpenTimeout();

            if (hoverOpenDelayMs <= 0) {
              showPopup();
              return;
            }

            openTimeoutId = window.setTimeout(() => {
              showPopup();
            }, hoverOpenDelayMs);
          };

          const closePopup = () => {
            clearOpenTimeout();
            clearLeaveTimeout();

            if (!popup?.isOpen()) {
              return;
            }

            popup.remove();
          };

          const scheduleClosePopup = () => {
            clearOpenTimeout();
            clearLeaveTimeout();
            leaveTimeoutId = window.setTimeout(() => {
              closePopup();
            }, 140);
          };

          element.addEventListener("mouseenter", openPopup);
          element.addEventListener("mouseleave", scheduleClosePopup);
          popupElement.addEventListener("mouseenter", clearLeaveTimeout);
          popupElement.addEventListener("mouseleave", scheduleClosePopup);
          cleanup = () => {
            clearOpenTimeout();
            clearLeaveTimeout();
            element.removeEventListener("mouseenter", openPopup);
            element.removeEventListener("mouseleave", scheduleClosePopup);
            popupElement.removeEventListener("mouseenter", clearLeaveTimeout);
            popupElement.removeEventListener("mouseleave", scheduleClosePopup);
            closePopup();
          };
        }

        return {
          marker,
          element,
          popup,
          definition: markerDefinition,
          cleanup,
        };
      });

      const handleMarkerZoom = () => {
        const zoom = map.getZoom();

        for (const markerRef of markerRefs.current) {
          const isInteractable = applyMarkerZoomStyle(
            markerRef.element,
            markerRef.definition,
            zoom,
          );

          if (!isInteractable && markerRef.popup?.isOpen()) {
            markerRef.popup.remove();
          }
        }
      };

      handleMarkerZoom();
      map.on("zoom", handleMarkerZoom);

      return () => {
        map.off("zoom", handleMarkerZoom);
      };
    }

    let cleanupSync: (() => void) | undefined;

    void syncMarkers().then((cleanup) => {
      cleanupSync = cleanup;
    });

    return () => {
      disposed = true;
      cleanupSync?.();
      for (const markerRef of markerRefs.current) {
        markerRef.cleanup?.();
        markerRef.popup?.remove();
        markerRef.marker.remove();
      }
      markerRefs.current = [];
    };
  }, [hasMapboxToken, mapReady, markers]);

  useEffect(() => {
    if (!hasMapboxToken || !mapReady || !mapRef.current) {
      return;
    }

    const map = mapRef.current;
    const cleanupIds: string[] = [];

    for (const line of lines) {
      if (line.coordinates.length < 2) {
        continue;
      }

      const sourceId = `map-canvas-line-source-${line.id}`;
      const layerId = `map-canvas-line-layer-${line.id}`;

      safelyRemoveLayer(map, layerId);
      safelyRemoveSource(map, sourceId);

      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: line.coordinates,
          },
          properties: {},
        },
      });

      map.addLayer({
        id: layerId,
        type: "line",
        source: sourceId,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": line.color ?? "#2563eb",
          "line-width": line.width ?? 4,
          "line-opacity": line.opacity ?? 0.7,
        },
      });

      cleanupIds.push(layerId, sourceId);
    }

    return () => {
      for (const id of cleanupIds) {
        safelyRemoveLayer(map, id);
        safelyRemoveSource(map, id);
      }
    };
  }, [hasMapboxToken, lines, mapReady]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-[#efede4]", className)}>
      {hasMapboxToken ? (
        <div ref={containerRef} className="h-full w-full" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#fbfbf8_0%,#f2f1eb_48%,#ebe8dd_100%)] text-center">
          <div className="max-w-[280px] px-6">
            <p className="text-[13px] font-medium text-[#1d1d1b]">{missingTokenTitle}</p>
            <p className="mt-1 text-[12px] leading-5 text-[#6b6b67]">{missingTokenDetail}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function applyMarkerZoomStyle(element: HTMLElement, marker: MapCanvasMarker, zoom: number) {
  const minVisibleZoom = marker.minVisibleZoom ?? 10.5;
  const fullSizeZoom = marker.fullSizeZoom ?? 13.5;
  const minScale = marker.minScale ?? 0.28;
  const minOpacity = marker.minOpacity ?? 0.16;
  const zoomRange = Math.max(fullSizeZoom - minVisibleZoom, 0.001);
  const progress = Math.min(Math.max((zoom - minVisibleZoom) / zoomRange, 0), 1);
  const scale = minScale + (1 - minScale) * progress;
  const opacity = minOpacity + (1 - minOpacity) * progress;
  const visualElement =
    (element.querySelector<HTMLElement>("[data-map-marker-visual]") ?? element);
  const isInteractable = progress > 0.02;

  visualElement.style.opacity = opacity.toFixed(3);
  visualElement.style.transform = `scale(${scale.toFixed(3)})`;
  visualElement.style.transformOrigin = "50% 50%";
  visualElement.style.visibility = isInteractable ? "visible" : "hidden";
  element.style.pointerEvents = isInteractable ? "auto" : "none";

  return isInteractable;
}

function safelyRemoveLayer(map: mapboxgl.Map, layerId: string) {
  try {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  } catch {
    // Ignore teardown races after the map instance has been removed.
  }
}

function safelyRemoveSource(map: mapboxgl.Map, sourceId: string) {
  try {
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  } catch {
    // Ignore teardown races after the map instance has been removed.
  }
}
