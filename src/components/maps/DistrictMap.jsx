import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './DistrictMap.css'

// Fix Leaflet default icon issue (even though we don't show markers, keeps parity)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const GEOJSON_PATH = '/bangladesh_geojson_adm2_64_districts_zillas.json'

const DISTRICT_SPELLING_CORRECTIONS = {
  "Cox's Bazar": "Cox's Bazar",
  'Coxs Bazar': "Cox's Bazar",
  'Cox Bazar': "Cox's Bazar",
  'Comilla': 'Comilla',
  'Cumilla': 'Comilla',
  'Jashore': 'Jessore',
  'Jessore': 'Jessore',
  'Chittagong': 'Chittagong',
  'Chattogram': 'Chittagong',
  'Netrokona': 'Netrokona',
  'Netrakona': 'Netrokona',
}

const normalizeName = (value) =>
  value ? value.toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '') : ''

const getDistrictColor = (count) => {
  if (!count) return '#0f172a'
  if (count < 5) return '#065f46'
  if (count < 10) return '#047857'
  if (count < 20) return '#059669'
  if (count < 50) return '#10b981'
  return '#34d399'
}

export function DistrictMap({ districtName, playerCount = 0, averageRating = 0 }) {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const geoJsonLayerRef = useRef(null)

  // Initialize base Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [23.7, 90.4],
      zoom: 7,
      minZoom: 6,
      maxZoom: 12,
      zoomControl: true,
      attributionControl: false,
    })

    mapRef.current = map

    // Ensure correct sizing
    setTimeout(() => {
      map.invalidateSize()
    }, 0)

    return () => {
      if (geoJsonLayerRef.current) {
        geoJsonLayerRef.current.remove()
      }
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Load GeoJSON + render highlight
  useEffect(() => {
    if (!mapRef.current || !districtName) return

    if (geoJsonLayerRef.current) {
      geoJsonLayerRef.current.remove()
      geoJsonLayerRef.current = null
    }

    fetch(GEOJSON_PATH)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load Bangladesh GeoJSON')
        return res.json()
      })
      .then((geoJson) => {
        if (!mapRef.current) return

        const normalizedTarget = normalizeName(districtName)
        let targetFeature = null

        geoJson.features.forEach((feature) => {
          const rawName =
            feature.properties?.district ||
            feature.properties?.name ||
            feature.properties?.ADM2_EN ||
            ''
          const correctedName = DISTRICT_SPELLING_CORRECTIONS[rawName] || rawName
          if (normalizeName(correctedName) === normalizedTarget) {
            feature.properties = {
              ...feature.properties,
              __isTarget: true,
              __displayName: correctedName,
            }
            targetFeature = feature
          } else {
            feature.properties = {
              ...feature.properties,
              __isTarget: false,
              __displayName: correctedName || rawName,
            }
          }
        })

        const layer = L.geoJSON(geoJson, {
          style: (feature) => {
            if (feature.properties?.__isTarget) {
              return {
                color: '#34d399',
                weight: 3,
                fillColor: getDistrictColor(playerCount),
                fillOpacity: 0.55,
                opacity: 1,
              }
            }
            return {
              color: '#1f2937',
              weight: 1,
              fillColor: '#0f172a',
              fillOpacity: 0.15,
              opacity: 0.3,
            }
          },
          onEachFeature: (_, leafletLayer) => {
            if (leafletLayer.feature?.properties?.__isTarget) {
              const districtLabel =
                leafletLayer.feature.properties.__displayName || districtName
              const tooltip = document.createElement('div')
              tooltip.className = 'district-map-tooltip'

              const title = document.createElement('div')
              title.className = 'district-map-tooltip-title'
              title.textContent = districtLabel
              tooltip.appendChild(title)

              if (playerCount > 0) {
                const countEl = document.createElement('div')
                countEl.className = 'district-map-tooltip-count'
                countEl.textContent = `${playerCount} ${
                  playerCount === 1 ? 'Player' : 'Players'
                }`
                tooltip.appendChild(countEl)
              } else {
                const emptyEl = document.createElement('div')
                emptyEl.className = 'district-map-tooltip-empty'
                emptyEl.textContent = 'No players yet'
                tooltip.appendChild(emptyEl)
              }

              if (averageRating > 0) {
                const ratingEl = document.createElement('div')
                ratingEl.className = 'district-map-tooltip-rating'
                ratingEl.textContent = `Avg rating: ${Math.round(averageRating)}`
                tooltip.appendChild(ratingEl)
              }

              leafletLayer.bindTooltip(tooltip, {
                permanent: false,
                direction: 'top',
                opacity: 1,
                className: 'district-map-tooltip-wrapper',
                offset: L.point(0, -12),
              })

              leafletLayer.on({
                mouseover: (e) => {
                  e.target.setStyle({
                    weight: 4,
                    fillOpacity: 0.7,
                  })
                },
                mouseout: (e) => {
                  e.target.setStyle({
                    weight: 3,
                    fillOpacity: 0.55,
                  })
                },
              })
            }
          },
        }).addTo(mapRef.current)

        geoJsonLayerRef.current = layer

        if (targetFeature) {
          const bounds = L.geoJSON(targetFeature).getBounds()
          if (bounds.isValid()) {
            mapRef.current.fitBounds(bounds, {
              padding: [40, 40],
              animate: false,
            })
          }
        }
      })
      .catch((err) => {
        console.error('[DistrictMap] Failed to render map:', err)
      })
  }, [districtName, playerCount, averageRating])

  return (
    <div className="district-map-container">
      <div ref={mapContainerRef} className="district-map-wrapper" />
    </div>
  )
}


