import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix icônes Leaflet avec Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const DRIVER_ICON = L.divIcon({
  html: `<div style="
    width:40px;height:40px;background:#FBBF24;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    border:3px solid #92400E;box-shadow:0 2px 8px rgba(0,0,0,0.3);
    font-size:20px;
  ">🚗</div>`,
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
})

const PICKUP_ICON = L.divIcon({
  html: `<div style="
    width:36px;height:36px;background:#22C55E;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    border:3px solid #15803D;box-shadow:0 2px 8px rgba(0,0,0,0.3);
    font-size:18px;
  ">📍</div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
})

const DROPOFF_ICON = L.divIcon({
  html: `<div style="
    width:36px;height:36px;background:#EF4444;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    border:3px solid #B91C1C;box-shadow:0 2px 8px rgba(0,0,0,0.3);
    font-size:18px;
  ">🏁</div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
})

export interface MapPoint {
  lat: number
  lng: number
  label?: string
}

interface MapViewProps {
  center?: MapPoint
  driverPosition?: MapPoint | null
  pickup?: MapPoint | null
  dropoff?: MapPoint | null
  height?: string
  className?: string
  onMapClick?: (lat: number, lng: number) => void
}

// Centre par défaut : Yaoundé
const YAOUNDE: MapPoint = { lat: 3.848, lng: 11.502 }

export function MapView({
  center,
  driverPosition,
  pickup,
  dropoff,
  height = '300px',
  className = '',
  onMapClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const driverMarkerRef = useRef<L.Marker | null>(null)
  const pickupMarkerRef = useRef<L.Marker | null>(null)
  const dropoffMarkerRef = useRef<L.Marker | null>(null)

  // Initialiser la carte une seule fois
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const mapCenter = center ?? driverPosition ?? pickup ?? YAOUNDE
    const map = L.map(containerRef.current, {
      center: [mapCenter.lat, mapCenter.lng],
      zoom: 14,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    if (onMapClick) {
      map.on('click', e => onMapClick(e.latlng.lat, e.latlng.lng))
    }

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Mise à jour position chauffeur (temps réel)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (driverPosition) {
      const latlng: L.LatLngExpression = [driverPosition.lat, driverPosition.lng]
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng(latlng)
      } else {
        driverMarkerRef.current = L.marker(latlng, { icon: DRIVER_ICON })
          .addTo(map)
          .bindPopup('Votre chauffeur')
      }
    } else {
      driverMarkerRef.current?.remove()
      driverMarkerRef.current = null
    }
  }, [driverPosition])

  // Marqueur départ
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (pickup) {
      const latlng: L.LatLngExpression = [pickup.lat, pickup.lng]
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setLatLng(latlng)
      } else {
        pickupMarkerRef.current = L.marker(latlng, { icon: PICKUP_ICON })
          .addTo(map)
          .bindPopup(pickup.label ?? 'Départ')
      }
      map.setView(latlng, 14)
    } else {
      pickupMarkerRef.current?.remove()
      pickupMarkerRef.current = null
    }
  }, [pickup])

  // Marqueur arrivée + trajet
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (dropoff) {
      const latlng: L.LatLngExpression = [dropoff.lat, dropoff.lng]
      if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.setLatLng(latlng)
      } else {
        dropoffMarkerRef.current = L.marker(latlng, { icon: DROPOFF_ICON })
          .addTo(map)
          .bindPopup(dropoff.label ?? 'Arrivée')
      }

      // Zoomer pour voir les deux points
      if (pickup) {
        const bounds = L.latLngBounds(
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng]
        )
        map.fitBounds(bounds, { padding: [40, 40] })
      }
    } else {
      dropoffMarkerRef.current?.remove()
      dropoffMarkerRef.current = null
    }
  }, [dropoff, pickup])

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className={`w-full rounded-2xl overflow-hidden z-0 ${className}`}
    />
  )
}
