import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import { Accelerometer } from 'expo-sensors';
import * as TaskManager from 'expo-task-manager';
import React, { useEffect, useRef, useState } from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 1. CONFIGURATION
const BACKGROUND_TASK = 'hix-background-mine';
const SUPABASE_URL = 'https://kgkukuesbjkzesnlpznk.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtna3VrdWVzYmpremVzbmxwem5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MDQ5NTcsImV4cCI6MjA4NTk4MDk1N30.cburEAObe2P-HD4bV8r2kOoVfzOZfUWtSKPP8qoTQGU'; // <--- PASTE YOUR KEY HERE

// 2. BACKGROUND TASK
TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    const queueJson = await AsyncStorage.getItem('motion_queue');
    const wallet = await AsyncStorage.getItem('hix_wallet');
    
    if (!queueJson || !wallet) return BackgroundFetch.BackgroundFetchResult.NoData;
    const queue = JSON.parse(queueJson);
    if (queue.length === 0) return BackgroundFetch.BackgroundFetchResult.NoData;

    const response = await fetch(`${SUPABASE_URL}/rest/v1/motion_data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(queue.map(q => ({
        wallet_address: wallet,
        acceleration: q.acc,
        rotation: [0,0,0],
        is_suspicious: false,
        magnitude: Math.sqrt(q.acc[0]**2 + q.acc[1]**2 + q.acc[2]**2),
        device_tier: 1
      })))
    });

    if (response.ok) {
      await AsyncStorage.setItem('motion_queue', JSON.stringify([]));
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    return BackgroundFetch.BackgroundFetchResult.Failed;
  } catch (err) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// 3. MAIN APP
export default function App() {
  const [mining, setMining] = useState(false);
  const [accel, setAccel] = useState({ x: 0, y: 0, z: 0 });
  const [vectorsMined, setVectorsMined] = useState(0);
  const queue = useRef([]);
  const TEST_WALLET = "GENESIS_NODE_001"; 

  useEffect(() => {
    const init = async () => {
      await AsyncStorage.setItem('hix_wallet', TEST_WALLET);
      try {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK, {
          minimumInterval: 60 * 15,
          stopOnTerminate: false,
          startOnBoot: true,
        });
      } catch (err) { console.log(err); }
    };
    init();
  }, []);

  const _toggleMining = async () => {
    if (mining) {
      Accelerometer.removeAllListeners();
      setMining(false);
    } else {
      Accelerometer.setUpdateInterval(16);
      Accelerometer.addListener(data => {
        setAccel(data);
        processMotion(data);
      });
      setMining(true);
    }
  };

  const processMotion = async (reading) => {
    const magnitude = Math.sqrt(reading.x ** 2 + reading.y ** 2 + reading.z ** 2);
    if (magnitude > 0.1 && magnitude < 20) {
      queue.current.push({ acc: [reading.x, reading.y, reading.z], ts: Date.now() });
      setVectorsMined(prev => prev + 1);
      if (queue.current.length >= 50) {
        const existing = await AsyncStorage.getItem('motion_queue');
        const currentStore = existing ? JSON.parse(existing) : [];
        await AsyncStorage.setItem('motion_queue', JSON.stringify([...currentStore, ...queue.current]));
        queue.current = []; 
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.header}>HIX PROTOCOL</Text>
      <View style={styles.radar}>
        <Text style={styles.label}>SENSOR FEED (60Hz)</Text>
        <Text style={styles.data}>X: {accel.x.toFixed(3)}</Text>
        <Text style={styles.data}>Y: {accel.y.toFixed(3)}</Text>
        <Text style={styles.data}>Z: {accel.z.toFixed(3)}</Text>
        <View style={styles.divider} />
        <Text style={styles.label}>VECTORS CAPTURED</Text>
        <Text style={styles.bigNum}>{vectorsMined}</Text>
      </View>
      <TouchableOpacity style={[styles.btn, mining ? styles.btnStop : styles.btnStart]} onPress={_toggleMining}>
        <Text style={styles.btnText}>{mining ? "STOP MINING" : "INITIATE SEQUENCE"}</Text>
      </TouchableOpacity>
      <Text style={styles.status}>{mining ? "● SYSTEM ACTIVE" : "○ SYSTEM STANDBY"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1B', padding: 20, paddingTop: 60, alignItems: 'center' },
  header: { color: '#FFF', fontSize: 28, fontWeight: '900', marginBottom: 30 },
  radar: { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 24, marginBottom: 30, borderColor: '#10B981', borderWidth: 1 },
  label: { color: '#9CA3AF', fontSize: 10, marginBottom: 10 },
  data: { color: '#10B981', fontFamily: 'monospace', fontSize: 24, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 20 },
  bigNum: { color: '#FFF', fontSize: 48, fontWeight: '900' },
  btn: { width: '100%', padding: 20, borderRadius: 12, alignItems: 'center' },
  btnStart: { backgroundColor: '#10B981' },
  btnStop: { backgroundColor: '#EF4444' },
  btnText: { color: '#FFF', fontWeight: '900', fontSize: 18 },
  status: { color: '#9CA3AF', marginTop: 20, fontSize: 12 }
});