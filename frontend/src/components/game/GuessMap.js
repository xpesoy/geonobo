// frontend/src/components/game/GuessMap.js
import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat, toLonLat } from 'ol/proj';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Style, Circle, Fill, Stroke } from 'ol/style';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';

const GuessMap = ({ onGuessSubmit, disabled }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerSource = useRef(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  
  // 지도 초기화
  useEffect(() => {
    // 벡터 레이어 소스 생성 (마커용)
    markerSource.current = new VectorSource();
    
    // 벡터 레이어 (마커 표시용)
    const markerLayer = new VectorLayer({
      source: markerSource.current,
      style: new Style({
        image: new Circle({
          radius: 7,
          fill: new Fill({ color: 'red' }),
          stroke: new Stroke({ color: 'white', width: 2 })
        })
      })
    });
    
    // 지도 인스턴스 생성
    mapInstance.current = new Map({
      target: mapRef.current,
      layers: [
        // 기본 지도 레이어 (OpenStreetMap)
        new TileLayer({
          source: new OSM()
        }),
        markerLayer
      ],
      view: new View({
        center: fromLonLat([0, 20]),
        zoom: 2,
        minZoom: 2,
        maxZoom: 18
      })
    });
    
    // 지도 클릭 이벤트 처리
    mapInstance.current.on('click', (evt) => {
      if (disabled) return;
      
      // 클릭한 위치의 좌표 변환 (OpenLayers 내부 좌표계 -> 경위도)
      const coords = toLonLat(evt.coordinate);
      const lng = coords[0];
      const lat = coords[1];
      
      setSelectedPosition({ lat, lng });
      
      // 마커 업데이트
      updateMarker(lng, lat);
    });
    
    // 컴포넌트 언마운트 시 지도 정리
    return () => {
      if (mapInstance.current) {
        mapInstance.current.setTarget(undefined);
        mapInstance.current = null;
      }
    };
  }, [disabled]);
  
  // 마커 업데이트 함수
  const updateMarker = (lng, lat) => {
    // 기존 마커 제거
    markerSource.current.clear();
    
    // 새 마커 추가
    const marker = new Feature({
      geometry: new Point(fromLonLat([lng, lat]))
    });
    
    markerSource.current.addFeature(marker);
  };
  
  // 추측 제출 핸들러
  const handleSubmit = () => {
    if (!selectedPosition || disabled) return;
    onGuessSubmit(selectedPosition);
  };
  
  return (
    <div className="h-full flex flex-col relative">
      <div ref={mapRef} className="w-full h-full"></div>
      
      {selectedPosition && !disabled && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <button 
            onClick={handleSubmit}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded shadow"
          >
            이 위치로 제출
          </button>
        </div>
      )}
      
      {disabled && (
        <div className="absolute top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded px-4 py-2 text-lg font-medium">
            {selectedPosition ? '제출 완료' : '제출 시간이 끝났습니다'}
          </div>
        </div>
      )}
    </div>
  );
};

export default GuessMap;