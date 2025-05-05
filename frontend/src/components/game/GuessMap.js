// frontend/src/components/game/GuessMap.js
import React, { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix for marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const MapClickHandler = ({ onMapClick }) => {
  const map = useMap();
  
  React.useEffect(() => {
    const handleClick = (e) => {
      onMapClick(e.latlng);
    };
    
    map.on('click', handleClick);
    
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onMapClick]);

  return null;
};

const GuessMap = ({ onGuessSubmit, disabled }) => {
  const [markerPosition, setMarkerPosition] = useState(null);
  
  const handleMapClick = useCallback((latlng) => {
    if (disabled) return;
    setMarkerPosition(latlng);
  }, [disabled]);

  const handleSubmit = () => {
    if (markerPosition && !disabled) {
      onGuessSubmit({
        lat: markerPosition.lat,
        lng: markerPosition.lng
      });
    }
  };

  return (
    <div className="relative h-full">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        className="h-full"
        style={{ height: '100%' }}
        worldCopyJump={true}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1.0}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          noWrap={false}
        />
        <MapClickHandler onMapClick={handleMapClick} />
        {markerPosition && (
          <Marker position={[markerPosition.lat, markerPosition.lng]} />
        )}
      </MapContainer>
      
      {markerPosition && !disabled && (
        <button
          onClick={handleSubmit}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded z-[1000]"
        >
          Submit Guess
        </button>
      )}
    </div>
  );
};

export default GuessMap;
