import MapLibreGL from "@maplibre/maplibre-react-native";
import { View, StyleSheet, Text } from "react-native";
import { useSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { obtenerRuta } from "../db/database";

export default function MapaRuta(){
  const { id } = useSearchParams();
  const [coords,setCoords] = useState([]);

  useEffect(()=>{ (async ()=>{ const r = await obtenerRuta(id); setCoords(r.map(p=>({latitude:p.lat, longitude:p.lon}))); })(); },[]);

  if(!coords.length) return (<View style={styles.center}><Text style={{color:'#fff'}}>Sin datos de GPS</Text></View>);

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView style={styles.map} styleURL="https://demotiles.maplibre.org/style.json">
        <MapLibreGL.Camera centerCoordinate={[coords[0].longitude, coords[0].latitude]} zoomLevel={12}/>
      </MapLibreGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1},
  map:{flex:1},
  center:{flex:1,justifyContent:'center',alignItems:'center'}
});