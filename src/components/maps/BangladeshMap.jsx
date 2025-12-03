import { useEffect, useRef, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './BangladeshMap.css'

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

export function BangladeshMap({ districts = [], onDistrictClick }) {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const geoJsonLayerRef = useRef(null)
  const labelsRef = useRef([])
  
  const districtMap = useMemo(() => {
    const map = new Map()
    districts.forEach(d => map.set(d.location, d))
    return map
  }, [districts])
  
  const maxPlayers = useMemo(() => {
    return Math.max(...districts.map(d => d.playerCount || 0), 1)
  }, [districts])
  
  // Get color based on player count
  const getDistrictColor = (playerCount) => {
    if (playerCount === 0) return '#1e293b'
    const intensity = Math.min(playerCount / maxPlayers, 1)
    if (intensity < 0.2) return '#065f46'
    if (intensity < 0.4) return '#047857'
    if (intensity < 0.6) return '#059669'
    if (intensity < 0.8) return '#10b981'
    return '#34d399'
  }
  
  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    
    const bangladeshBounds = [
      [20.6, 88.0],   // south-west
      [26.7, 92.7],   // north-east
    ]
    
    const map = L.map(mapContainerRef.current, {
      center: [23.7, 90.4],   // near Dhaka
      zoom: 7,
      minZoom: 7,
      maxZoom: 12,
      maxBounds: bangladeshBounds,
      maxBoundsViscosity: 0.9,
      zoomControl: true,
      attributionControl: false,
    })
    
    mapRef.current = map
    
    return () => {
      labelsRef.current.forEach(marker => marker.remove())
      if (geoJsonLayerRef.current) {
        geoJsonLayerRef.current.remove()
      }
      map.remove()
      mapRef.current = null
    }
  }, [])
  
  // Load GeoJSON and render districts
  useEffect(() => {
    if (!mapRef.current) return
    
    // Clear existing layers
    if (geoJsonLayerRef.current) {
      geoJsonLayerRef.current.remove()
    }
    labelsRef.current.forEach(marker => marker.remove())
    labelsRef.current = []
    
    // Load Bangladesh districts GeoJSON and district metadata
    Promise.all([
      fetch('/bangladesh_geojson_adm2_64_districts_zillas.json').then(res => {
        if (!res.ok) throw new Error('bangladesh_geojson_adm2_64_districts_zillas.json not found')
        return res.json()
      }),
      fetch('/bd-districts.json').then(res => {
        if (!res.ok) throw new Error('bd-districts.json not found')
        return res.json()
      })
    ])
      .then(([geoJsonData, districtsMetadata]) => {
        if (!mapRef.current) return
        
        // Create a map of district names from metadata for matching
        const metadataMap = new Map()
        const districtNamesSet = new Set()
        if (districtsMetadata.districts && Array.isArray(districtsMetadata.districts)) {
          districtsMetadata.districts.forEach((d) => {
            if (d.name) {
              metadataMap.set(d.name, d)
              districtNamesSet.add(d.name)
            }
          })
        }

        // Spelling correction map: GeoJSON NAME_3 -> bd-districts.json name
        const spellingCorrections = {
          'Bandarbon': 'Bandarban',
          'Bogra': 'Bogura',
          'Borgona': 'Barguna',
          'Chittagong': 'Chattogram',
          'Choua Danga': 'Chuadanga',
          'Comilla': 'Cumilla',
          'Gaibanda': 'Gaibandha',
          'Gopalgonj': 'Gopalganj',
          'Hobiganj': 'Habiganj',
          'Jaipurhat': 'Joypurhat',
          'Jessore': 'Jashore',
          'Jhalakati': 'Jhalokati',
          'Kustia': 'Kushtia',
          'Manikgonj': 'Manikganj',
          'Moulvibazar': 'Maulvibazar',
          'Munshigonj': 'Munshiganj',
          'Naray Angonj': 'Narayanganj',
          'Narshingdi': 'Narsingdi',
          'Netrakona': 'Netrokona',
          'Ranpur': 'Rangpur',
          'Rongpur': 'Rangpur',
          'Tangali': 'Tangail',
          'Barisal': 'Barishal',
          'Shatkhira': 'Satkhira',
          'Sun Amgonj': 'Sunamganj',
          'Parbattya Chattagram': 'Chattogram',
          'Nasirabad': 'Narsingdi',
        }
        
        // Extract district features
        const allFeatures = geoJsonData.features || []
        
        // Style function for districts
        const districtStyle = (feature) => {
          const districtName = feature.properties?.district ||
                              feature.properties?.name ||
                              ''

          const districtData = districtMap.get(districtName)
          const playerCount = districtData?.playerCount || 0

          const fillColor = getDistrictColor(playerCount)
          const strokeColor = playerCount > 0 ? '#10b981' : '#64748b'

          return {
            color: strokeColor,
            weight: playerCount > 0 ? 2 : 1,
            fillColor: fillColor,
            fillOpacity: playerCount > 0 ? 0.4 : 0.2,
            opacity: playerCount > 0 ? 0.9 : 0.6,
            dashArray: playerCount > 0 ? undefined : '5, 5',
          }
        }
        
        // On each district feature
        const onEachDistrict = (feature, layer) => {
          const districtName = feature.properties?.district ||
                              feature.properties?.name ||
                              ''

          const districtData = districtMap.get(districtName)
          const playerCount = districtData?.playerCount || 0
      
          // Tooltip with player info
          const tooltipContent = document.createElement('div')
          tooltipContent.className = 'bangladesh-map-tooltip-content'
          tooltipContent.innerHTML = `
            <strong class="bangladesh-map-tooltip-title">${districtName}</strong>
            ${playerCount > 0 
              ? `<span class="bangladesh-map-tooltip-count">${playerCount} ${playerCount === 1 ? 'player' : 'players'}</span>` 
              : '<span class="bangladesh-map-tooltip-empty">No players yet</span>'}
            ${districtData?.averageRating && districtData.averageRating > 0 
              ? `<small class="bangladesh-map-tooltip-rating">Avg: ${districtData.averageRating}</small>` 
              : ''}
          `
          
          layer.bindTooltip(tooltipContent, {
            sticky: true,
            direction: 'top',
            className: 'bangladesh-map-tooltip',
            opacity: 1,
          })
          
          // Hover effects
          layer.on({
            mouseover: (e) => {
              const target = e.target
              const currentPlayerCount = districtMap.get(districtName)?.playerCount || 0
              target.setStyle({
                weight: currentPlayerCount > 0 ? 3 : 2,
                color: currentPlayerCount > 0 ? '#34d399' : '#64748b',
                fillOpacity: currentPlayerCount > 0 ? 0.6 : 0.3,
              })
            },
            mouseout: (e) => {
              const target = e.target
              const currentPlayerCount = districtMap.get(districtName)?.playerCount || 0
              const currentFillColor = getDistrictColor(currentPlayerCount)
              target.setStyle({
                weight: currentPlayerCount > 0 ? 2 : 1,
                color: currentPlayerCount > 0 ? '#10b981' : '#64748b',
                fillColor: currentFillColor,
                fillOpacity: currentPlayerCount > 0 ? 0.4 : 0.2,
                opacity: currentPlayerCount > 0 ? 0.9 : 0.6,
                dashArray: currentPlayerCount > 0 ? undefined : '5, 5',
              })
            },
            click: () => {
              if (playerCount > 0 && onDistrictClick) {
                onDistrictClick(districtName)
              }
            },
          })
          
          // Add district name label at geometric centroid
          if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            const calculatePolygonCentroid = (ring) => {
              if (ring.length < 3) {
                const avgLat = ring.reduce((sum, p) => sum + p[1], 0) / ring.length
                const avgLng = ring.reduce((sum, p) => sum + p[0], 0) / ring.length
                return [avgLat, avgLng]
              }
              
              let area = 0
              let centroidLat = 0
              let centroidLng = 0
              
              for (let i = 0; i < ring.length - 1; i++) {
                const p1 = ring[i]
                const p2 = ring[i + 1]
                const cross = p1[0] * p2[1] - p2[0] * p1[1]
                area += cross
                centroidLat += (p1[1] + p2[1]) * cross
                centroidLng += (p1[0] + p2[0]) * cross
              }
              
              if (Math.abs(area) < 1e-10) {
                const avgLat = ring.reduce((sum, p) => sum + p[1], 0) / ring.length
                const avgLng = ring.reduce((sum, p) => sum + p[0], 0) / ring.length
                return [avgLat, avgLng]
              }
              
              area /= 2
              centroidLat /= (6 * area)
              centroidLng /= (6 * area)
              
              return [centroidLat, centroidLng]
            }
            
            const bounds = layer.getBounds()
            const boundsCenter = bounds.getCenter()
            
            let finalCentroid
            
            if (feature.geometry.type === 'Polygon') {
              const outerRing = feature.geometry.coordinates[0]
              finalCentroid = calculatePolygonCentroid(outerRing)
            } else if (feature.geometry.type === 'MultiPolygon') {
              let totalArea = 0
              let weightedLat = 0
              let weightedLng = 0
              
              feature.geometry.coordinates.forEach((polygon) => {
                const ring = polygon[0]
                if (ring.length >= 3) {
                  let area = 0
                  for (let i = 0; i < ring.length - 1; i++) {
                    const p1 = ring[i]
                    const p2 = ring[i + 1]
                    area += p1[0] * p2[1] - p2[0] * p1[1]
                  }
                  area = Math.abs(area / 2)
                  
                  if (area > 0) {
                    const centroid = calculatePolygonCentroid(ring)
                    weightedLat += centroid[0] * area
                    weightedLng += centroid[1] * area
                    totalArea += area
                  }
                }
              })
              
              if (totalArea > 0) {
                finalCentroid = [weightedLat / totalArea, weightedLng / totalArea]
              } else {
                finalCentroid = [boundsCenter.lat, boundsCenter.lng]
              }
            } else {
              finalCentroid = [boundsCenter.lat, boundsCenter.lng]
            }
            
            finalCentroid = [
              Math.max(bounds.getSouth(), Math.min(bounds.getNorth(), finalCentroid[0])),
              Math.max(bounds.getWest(), Math.min(bounds.getEast(), finalCentroid[1])),
            ]
            
            const labelIcon = L.divIcon({
              className: 'district-label',
              html: `<div style="
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 2px 6px;
                font-size: 10px;
                font-weight: 600;
                color: ${playerCount > 0 ? '#1e293b' : '#64748b'};
                text-shadow: 0 0 3px #ffffff, 0 0 3px #ffffff, 0 0 3px #ffffff;
                pointer-events: none;
                white-space: nowrap;
                max-width: 120px;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.2;
              ">${districtName}</div>`,
              iconSize: [120, 24],
              iconAnchor: [60, 12],
            })
            
            const label = L.marker(finalCentroid, {
              icon: labelIcon,
              interactive: false,
              zIndexOffset: 1000,
            }).addTo(mapRef.current)
            
            labelsRef.current.push(label)
          }
        }
        
        // Match districts by ADM2_EN with spelling corrections
        const groupedFeatures = []
        const matchedFeatureIds = new Set()
        
        let matchCount = 0
        allFeatures.forEach((feature, index) => {
          let geoName = feature.properties?.ADM2_EN || ''
          const originalName = geoName
          
          if (geoName && spellingCorrections[geoName]) {
            geoName = spellingCorrections[geoName]
          }
          
          if (geoName && districtNamesSet.has(geoName)) {
            feature.properties = {
              ...feature.properties,
              district: geoName,
              name: geoName,
            }
            groupedFeatures.push(feature)
            matchedFeatureIds.add(index)
            matchCount++
            return
          }
          
          for (const districtName of districtNamesSet) {
            if (geoName && (
              geoName.toLowerCase() === districtName.toLowerCase() || 
              geoName.toLowerCase().includes(districtName.toLowerCase()) ||
              districtName.toLowerCase().includes(geoName.toLowerCase())
            )) {
              feature.properties = {
                ...feature.properties,
                district: districtName,
                name: districtName,
              }
              groupedFeatures.push(feature)
              matchedFeatureIds.add(index)
              matchCount++
              return
            }
          }
        })
        
        // Add remaining features
        allFeatures.forEach((feature, index) => {
          if (!matchedFeatureIds.has(index)) {
            let geoName = feature.properties?.ADM2_EN || ''
            const originalName = geoName
            
            if (geoName && spellingCorrections[geoName]) {
              geoName = spellingCorrections[geoName]
            }
            
            let matchedDistrict = ''
            if (geoName && districtNamesSet.has(geoName)) {
              matchedDistrict = geoName
            } else {
              for (const districtName of districtNamesSet) {
                if (geoName && geoName.toLowerCase() === districtName.toLowerCase()) {
                  matchedDistrict = districtName
                  break
                }
              }
            }
            
            const fallbackName = matchedDistrict || geoName || 'Unknown'
            feature.properties = {
              ...feature.properties,
              district: fallbackName,
              name: fallbackName,
            }
            groupedFeatures.push(feature)
          }
        })
        
        const groupedGeoJson = {
          type: 'FeatureCollection',
          features: groupedFeatures,
        }
        
        const countryBorderGeoJson = {
          type: 'FeatureCollection',
          features: groupedFeatures,
        }
        
        const countryBorder = L.geoJSON(countryBorderGeoJson, {
          style: () => ({
            color: '#10b981',
            weight: 1,
            fill: false,
            opacity: 0.9,
            dashArray: '10, 5',
          }),
        })
        
        const districtsLayer = L.geoJSON(groupedGeoJson, {
          style: districtStyle,
          onEachFeature: onEachDistrict,
        })
        
        countryBorder.addTo(mapRef.current)
        districtsLayer.addTo(mapRef.current)
        
        geoJsonLayerRef.current = L.layerGroup([countryBorder, districtsLayer])
      })
      .catch(err => {
        console.error('Failed to load Bangladesh GeoJSON files:', err)
      })
  }, [districts, districtMap, maxPlayers, onDistrictClick])
  
  return (
    <div className="bangladesh-map-container">
      <div 
        ref={mapContainerRef}
        className="bangladesh-map-wrapper"
      />
      
      <div className="bangladesh-map-legend">
        <span className="bangladesh-map-legend-label">Player Density:</span>
        <div className="bangladesh-map-legend-items">
          <div className="bangladesh-map-legend-item">
            <div className="bangladesh-map-legend-color" style={{ backgroundColor: '#065f46' }}></div>
            <span>Low</span>
          </div>
          <div className="bangladesh-map-legend-item">
            <div className="bangladesh-map-legend-color" style={{ backgroundColor: '#047857' }}></div>
            <span>Medium</span>
          </div>
          <div className="bangladesh-map-legend-item">
            <div className="bangladesh-map-legend-color" style={{ backgroundColor: '#10b981' }}></div>
            <span>High</span>
          </div>
          <div className="bangladesh-map-legend-item">
            <div className="bangladesh-map-legend-color" style={{ backgroundColor: '#34d399' }}></div>
            <span>Very High</span>
          </div>
        </div>
      </div>
    </div>
  )
}
