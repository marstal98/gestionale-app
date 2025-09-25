import React, { useMemo, useState, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import MiniBarChart from './MiniBarChart';

function movingAverage(arr, window = 3) {
  const res = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    const avg = slice.reduce((s, v) => s + v, 0) / slice.length;
    res.push(Math.round(avg * 100) / 100);
  }
  return res;
}

export default function DetailedOrdersChart({ data = [], title = 'Andamento ordini (30 giorni)' }) {
  const [showMA, setShowMA] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const [tooltip, setTooltip] = useState(null); // { index, value, x, label }
  const hideTimer = useRef(null);
  const total = useMemo(() => data.reduce((s, v) => s + (Number(v) || 0), 0), [data]);
  const avg = useMemo(() => (data.length ? Math.round((total / data.length) * 100) / 100 : 0), [data, total]);
  const ma = useMemo(() => movingAverage(data, 5), [data]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Totale: {total} — Media giornaliera: {avg}</Text>
        </View>
        <View>
          <Button mode="contained" onPress={() => setShowMA(s => !s)}>{showMA ? 'Nascondi media' : 'Mostra media mobile'}</Button>
        </View>
      </View>

      <Surface style={styles.chartSurface} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
        <MiniBarChart data={data} height={220} color="#1976D2" onBarPress={(i, v) => {
          // derive a date label assuming data is last N days (newest-last)
          const len = data.length || 1;
          const daysAgo = len - 1 - i;
          const d = new Date();
          d.setDate(d.getDate() - daysAgo);
          const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
          // compute x position roughly: center of the bar
          const x = chartWidth ? ((i + 0.5) * (chartWidth / len)) : 0;
          setTooltip({ index: i, value: v, x, label });
          if (hideTimer.current) clearTimeout(hideTimer.current);
          hideTimer.current = setTimeout(() => setTooltip(null), 3000);
        }} />
        {tooltip && (
          <View style={[styles.tooltip, { left: Math.max(8, tooltip.x - 50) }]}> 
            <Text style={{ fontWeight: '700' }}>{tooltip.value}</Text>
            <Text style={{ color: '#666', fontSize: 12 }}>{tooltip.label}</Text>
          </View>
        )}
        {showMA && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: '#666' }}>Media mobile (5 giorni) evidenziata nella linea sottostante.</Text>
            <View style={{ marginTop: 8, height: 60, justifyContent: 'center' }}>
              {/* Simple row to show MA values as text for now */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {ma.map((m, idx) => (
                  <View key={idx} style={{ paddingHorizontal: 6 }}><Text style={{ fontSize: 12, color: '#444' }}>{m}</Text></View>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </Surface>

      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: '700' }}>Dettagli</Text>
        <Text style={{ color: '#666', marginTop: 6 }}>Scorri per vedere i valori giornalieri. Tocca una barra nel grafico per evidenziare il valore.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { marginTop: 6, color: '#666' },
  chartSurface: { marginTop: 12, padding: 12, borderRadius: 12, elevation: 2 }
  ,
  tooltip: {
    position: 'absolute',
    top: 8,
    width: 100,
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 6,
    alignItems: 'center'
  }
});

