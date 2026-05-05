import L from 'leaflet';
import { useEffect, useRef } from 'react';

import 'leaflet/dist/leaflet.css';

import type { StatusIncendio } from '@/types/dashboard';

export type MapIncendio = {
    id: string;
    latitude: number;
    longitude: number;
    status: StatusIncendio;
    nivel_risco: string;
    area_nome: string;
    detectado_em?: string | null;
    local_critico_nome?: string | null;
};

type MapComponentProps = {
    incendios: MapIncendio[];
    center?: [number, number];
    zoom?: number;
    className?: string;
    onMapClick?: (lat: number, lng: number) => void;
    onMarkerClick?: (incendioId: string) => void;
    selectedPoint?: { lat: number; lng: number } | null;
};

const statusLabels: Record<StatusIncendio, string> = {
    ativo: 'ATIVO',
    em_combate: 'EM COMBATE',
    contido: 'CONTIDO',
    resolvido: 'RESOLVIDO',
    inviavel: 'INVIÁVEL',
};

function getMarkerColor(status: StatusIncendio): string {
    switch (status) {
        case 'ativo':
            return '#ef4444';
        case 'em_combate':
            return '#f97316';
        case 'contido':
            return '#eab308';
        case 'resolvido':
            return '#22c55e';
        case 'inviavel':
            return '#6b7280';
    }
}

function createFireIcon(color: string): L.DivIcon {
    return L.divIcon({
        html: `<div style="
      width: 24px; height: 24px;
      background: ${color};
      border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.8);
      box-shadow: 0 0 12px ${color}88;
      display: flex; align-items: center; justify-content: center;
    "><svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9.1 12 1 12 1s8 8.1 8 13.5c0 5.4-4.4 8.5-8 8.5z"/></svg></div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });
}

const selectedIcon = L.divIcon({
    html: `<div style="
    width: 28px; height: 28px;
    background: hsl(36, 95%, 50%);
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 0 16px hsl(36, 95%, 50%, 0.6);
    animation: pulse 1.5s infinite;
  "></div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
});

export function MapComponent({
    incendios,
    center = [-18.05, -57.45],
    zoom = 11,
    className = '',
    onMapClick,
    onMarkerClick,
    selectedPoint,
}: MapComponentProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const selectedMarkerRef = useRef<L.Marker | null>(null);
    const onMapClickRef = useRef(onMapClick);
    const onMarkerClickRef = useRef(onMarkerClick);
    onMapClickRef.current = onMapClick;
    onMarkerClickRef.current = onMarkerClick;

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) {
            return;
        }

        const map = L.map(mapRef.current, {
            center,
            zoom,
            zoomControl: false,
        });

        L.control.zoom({ position: 'topright' }).addTo(map);

        const satellite = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            {
                attribution: 'Esri, Maxar, Earthstar Geographics',
                maxZoom: 18,
            },
        );

        const topo = L.tileLayer(
            'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            { attribution: 'OpenTopoMap', maxZoom: 17 },
        );

        const osm = L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            { attribution: '© OpenStreetMap', maxZoom: 19 },
        );

        satellite.addTo(map);

        L.control.layers(
            { Satélite: satellite, Topografia: topo, 'Mapa Base': osm },
            {},
            { position: 'topright' },
        ).addTo(map);

        incendios.forEach((inc) => {
            const color = getMarkerColor(inc.status);
            const marker = L.marker([inc.latitude, inc.longitude], {
                icon: createFireIcon(color),
                opacity: inc.status === 'resolvido' ? 0.4 : 1,
            }).addTo(map);

            const riskLabel = inc.nivel_risco.toUpperCase();
            const btnHtml = onMarkerClickRef.current
                ? `<button data-incendio-id="${inc.id}" type="button" style="
                    margin-top: 8px; width: 100%; padding: 4px 8px;
                    background: hsl(18, 88%, 46%); color: white;
                    border: none; border-radius: 6px; font-size: 11px;
                    font-weight: 600; cursor: pointer;
                  ">Detalhes</button>`
                : '';

            const popup = L.popup().setContent(`
                <div style="font-family: system-ui, sans-serif; min-width: 200px;">
                  <strong style="font-size: 14px;">${inc.area_nome}</strong>
                  ${inc.local_critico_nome ? `<p style="margin: 2px 0; font-size: 11px; color: #888;">📍 ${inc.local_critico_nome}</p>` : ''}
                  <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <span style="background: ${color}22; color: ${color}; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                      ${statusLabels[inc.status]}
                    </span>
                    <span style="font-size: 11px; color: #888;">
                      ${riskLabel}
                    </span>
                  </div>
                  ${inc.detectado_em ? `<p style="margin-top: 6px; font-size: 10px; color: #999;">Detectado: ${new Date(inc.detectado_em).toLocaleDateString('pt-BR')}</p>` : ''}
                  ${btnHtml}
                </div>
            `);

            marker.bindPopup(popup);

            marker.on('popupopen', () => {
                const btn = document.querySelector(
                    `button[data-incendio-id="${inc.id}"]`,
                );
                if (btn) {
                    btn.addEventListener('click', () => {
                        onMarkerClickRef.current?.(inc.id);
                        map.closePopup();
                    });
                }
            });
        });

        if (incendios.length > 0) {
            const bounds = L.latLngBounds(
                incendios.map((i) => [i.latitude, i.longitude]),
            );
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        }

        const handler = (e: L.LeafletMouseEvent) => {
            onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
        };
        map.on('click', handler);

        mapInstanceRef.current = map;

        return () => {
            map.off('click', handler);
            map.remove();
            mapInstanceRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- map init once per mount
    }, []);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) {
            return;
        }

        if (selectedMarkerRef.current) {
            map.removeLayer(selectedMarkerRef.current);
            selectedMarkerRef.current = null;
        }

        if (selectedPoint) {
            const marker = L.marker([selectedPoint.lat, selectedPoint.lng], {
                icon: selectedIcon,
            }).addTo(map);
            marker.bindPopup('Localização selecionada').openPopup();
            selectedMarkerRef.current = marker;
        }
    }, [selectedPoint]);

    return <div ref={mapRef} className={`w-full h-full ${className}`} />;
}
