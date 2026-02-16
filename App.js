import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = 'https://kgkukuesbjkzesnlpznk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtna3VrdWVzYmpremVzbmxwem5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NjUxMDUsImV4cCI6MjA1NDA0MTEwNX0.IUToCpQH_Xr3MmqkqQUc8YmL83p9zDfWiAx8aQEfE8o';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export default function App() {
  const [callsign, setCallsign] = useState('');
  const [mining, setMining] = useState(false);
  const [vectors, setVectors] = useState(0);
  const [hixEarned, setHixEarned] = useState(0.0);
  const [tier, setTier] = useState(1);
  const [bonus, setBonus] = useState(1.0);
  const [distance, setDistance] = useState(0.0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [networkStats, setNetworkStats] = useState({
    totalVectors: 0,
    activeMiners: 0,
    validators: 0
  });
  const [currentTask, setCurrentTask] = useState('General Mining');
  const [taskMultiplier, setTaskMultiplier] = useState(1.0);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState({
    motion: false,
    location: false
  });

  const dataQueue = useRef([]);
  const sessionId = useRef(generateSessionId());
  const lastLocation = useRef(null);
  const totalDistance = useRef(0);
  const uploadInterval = useRef(null);
  const leaderboardInterval = useRef(null);
  const networkStatsInterval = useRef(null);

  function generateSessionId() {
    return 'SESSION_' + Date.now() + '_' + Math.random().toString(36).substring(7);
  }

  function generateCallsign() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'HIX_';
    for (let i = 0; i < 12; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  useEffect(() => {
    initializeApp();
    return () => cleanup();
  }, []);

  async function initializeApp() {
    try {
      const savedCallsign = await AsyncStorage.getItem('hix_callsign');
      const savedVectors = await AsyncStorage.getItem('hix_vectors');
      const savedHix = await AsyncStorage.getItem('hix_earned');
      
      if (savedCallsign) {
        setCallsign(savedCallsign);
      } else {
        const newCallsign = generateCallsign();
        setCallsign(newCallsign);
        await AsyncStorage.setItem('hix_callsign', newCallsign);
      }
      
      if (savedVectors) setVectors(parseInt(savedVectors, 10));
      if (savedHix) setHixEarned(parseFloat(savedHix));

      await requestAllPermissions();
      fetchLeaderboard();
      fetchNetworkStats();

      leaderboardInterval.current = setInterval(fetchLeaderboard, 30000);
      networkStatsInterval.current = setInterval(fetchNetworkStats, 15000);
    } catch (error) {
      console.error('Init error:', error);
    }
  }

  function cleanup() {
    if (uploadInterval.current) clearInterval(uploadInterval.current);
    if (leaderboardInterval.current) clearInterval(leaderboardInterval.current);
    if (networkStatsInterval.current) clearInterval(networkStatsInterval.current);
    Accelerometer.removeAllListeners();
    Gyroscope.removeAllListeners();
  }

  async function requestAllPermissions() {
    const newPermissions = { ...permissionsGranted };

    try {
      await Accelerometer.isAvailableAsync();
      newPermissions.motion = true;
    } catch (e) {
      console.log('Motion unavailable');
    }

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        newPermissions.location = true;
      }
    } catch (e) {
      console.error('Location error:', e);
    }

    setPermissionsGranted(newPermissions);
  }

  useEffect(() => {
    let locationSubscription;

    async function startLocationTracking() {
      if (!permissionsGranted.location) return;

      try {
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 15,
          },
          (location) => {
            if (lastLocation.current) {
              const dist = calculateDistance(
                lastLocation.current.coords.latitude,
                lastLocation.current.coords.longitude,
                location.coords.latitude,
                location.coords.longitude
              );

              if (dist > 0.015) {
                totalDistance.current += dist;
                setDistance(totalDistance.current);
                setBonus(prev => Math.min(prev + 0.3, 5.0));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
            }
            lastLocation.current = location;
          }
        );
      } catch (error) {
        console.error('Location tracking error:', error);
      }
    }

    if (mining && permissionsGranted.location) {
      startLocationTracking();
    }

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, [mining, permissionsGranted.location]);

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  async function toggleMining() {
    if (!callsign.trim()) {
      Alert.alert('Callsign Required', 'Please enter your callsign.');
      return;
    }

    if (mining) {
      stopMining();
    } else {
      await startMining();
    }
  }

  async function startMining() {
    await AsyncStorage.setItem('hix_callsign', callsign);
    setMining(true);
    sessionId.current = generateSessionId();
    
    let currentTier = 1;
    if (permissionsGranted.location) currentTier = 3;
    setTier(currentTier);

    Accelerometer.setUpdateInterval(20);
    Gyroscope.setUpdateInterval(20);

    Accelerometer.addListener(handleAccelerometer);
    Gyroscope.addListener(handleGyroscope);

    uploadInterval.current = setInterval(() => {
      if (dataQueue.current.length >= 40) {
        uploadBatch();
      }
    }, 5000);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function stopMining() {
    setMining(false);
    Accelerometer.removeAllListeners();
    Gyroscope.removeAllListeners();

    if (uploadInterval.current) {
      clearInterval(uploadInterval.current);
      uploadInterval.current = null;
    }
    if (dataQueue.current.length > 0) uploadBatch();

    saveProgress();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }

  function handleAccelerometer(data) {
    if (!mining) return;

    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);

    if (magnitude > 1.2) {
      const totalMultiplier = tier * taskMultiplier * bonus;
      const hixReward = 0.0001 * totalMultiplier;

      setVectors(v => v + 1);
      setHixEarned(h => h + hixReward);

      dataQueue.current.push({
        acceleration: [data.x, data.y, data.z],
        rotation: [0, 0, 0],
        magnitude: magnitude,
        timestamp: Date.now()
      });

      if (Math.random() > 0.95) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }

  function handleGyroscope(data) {
    if (dataQueue.current.length > 0) {
      const lastEntry = dataQueue.current[dataQueue.current.length - 1];
      lastEntry.rotation = [data.x, data.y, data.z];
    }
  }

  async function uploadBatch() {
    if (dataQueue.current.length === 0) return;

    const batch = dataQueue.current.splice(0, 40);

    try {
      for (const motion of batch) {
        await supabase.rpc('submit_motion', {
          p_wallet_address: callsign,
          p_acceleration: motion.acceleration,
          p_rotation: motion.rotation,
          p_session_id: sessionId.current,
          p_device_tier: tier
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      saveProgress();
    } catch (error) {
      console.error('Upload error:', error);
      dataQueue.current = [...batch, ...dataQueue.current];
    }
  }

  async function saveProgress() {
    try {
      await AsyncStorage.setItem('hix_vectors', vectors.toString());
      await AsyncStorage.setItem('hix_earned', hixEarned.toString());
    } catch (error) {
      console.error('Save error:', error);
    }
  }

  async function fetchLeaderboard() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('wallet_address, total_vectors, earned_hix')
        .order('total_vectors', { ascending: false })
        .limit(10);

      if (error) throw error;
      if (data) setLeaderboard(data);
    } catch (error) {
      console.error('Leaderboard error:', error);
    }
  }

  async function fetchNetworkStats() {
    try {
      const { data, error } = await supabase
        .from('network_stats')
        .select('*')
        .single();

      if (error) throw error;
      if (data) {
        setNetworkStats({
          totalVectors: data.total_vectors || 0,
          activeMiners: data.active_miners_24h || 0,
          validators: data.active_validators || 0
        });
      }
    } catch (error) {
      console.error('Stats error:', error);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([fetchLeaderboard(), fetchNetworkStats()]);
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.header}>
          <Text style={styles.logo}>🤖 HIX Protocol</Text>
          <Text style={styles.subtitle}>Training Tomorrow's Robots</Text>
        </LinearGradient>

        <View style={styles.networkPulse}>
          <View style={styles.pulseItem}>
            <Text style={styles.pulseValue}>{networkStats.totalVectors.toLocaleString()}</Text>
            <Text style={styles.pulseLabel}>Network Vectors</Text>
          </View>
          <View style={styles.pulseItem}>
            <Text style={styles.pulseValue}>{networkStats.activeMiners}</Text>
            <Text style={styles.pulseLabel}>Active Miners</Text>
          </View>
          <View style={styles.pulseItem}>
            <Text style={styles.pulseValue}>{networkStats.validators}</Text>
            <Text style={styles.pulseLabel}>Validators</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Node Callsign</Text>
          <TextInput
            style={styles.input}
            value={callsign}
            onChangeText={setCallsign}
            placeholder="Enter your callsign"
            placeholderTextColor="#666"
            autoCapitalize="characters"
            editable={!mining}
          />
        </View>

        <LinearGradient
          colors={['rgba(99, 102, 241, 0.2)', 'rgba(79, 70, 229, 0.1)']}
          style={styles.earningsCard}
        >
          <Text style={styles.earningsLabel}>Total HIX Earned</Text>
          <Text style={styles.earningsValue}>{hixEarned.toFixed(4)} HIX</Text>
          <View style={styles.earningsRow}>
            <Text style={styles.earningsStat}>{vectors.toLocaleString()} Vectors</Text>
            <Text style={styles.earningsStat}>Tier {tier}</Text>
            <Text style={styles.earningsStat}>{(tier * taskMultiplier * bonus).toFixed(1)}X</Text>
          </View>
        </LinearGradient>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{distance.toFixed(2)} km</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Tier</Text>
            <Text style={styles.statValue}>{tier}X</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Mission</Text>
          <View style={styles.taskGrid}>
            {MISSIONS.map((mission, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.taskButton,
                  currentTask === mission.name && styles.taskButtonActive
                ]}
                onPress={() => {
                  setCurrentTask(mission.name);
                  setTaskMultiplier(mission.multiplier);
                }}
              >
                <Text style={styles.taskIcon}>{mission.icon}</Text>
                <Text style={styles.taskName}>{mission.name}</Text>
                <Text style={styles.taskMultiplier}>{mission.multiplier}X</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.mineButton, mining && styles.mineButtonActive]}
          onPress={toggleMining}
        >
          <LinearGradient
            colors={mining ? ['#EF4444', '#DC2626'] : ['#10B981', '#059669']}
            style={styles.mineButtonGradient}
          >
            <Text style={styles.mineButtonText}>
              {mining ? '⏸️ Stop Mining' : '⚙️ Start Mining'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏆 Global Leaderboard</Text>
          {leaderboard.map((entry, index) => (
            <View
              key={index}
              style={[
                styles.leaderEntry,
                entry.wallet_address === callsign && styles.leaderEntryHighlight
              ]}
            >
              <Text style={styles.leaderRank}>#{index + 1}</Text>
              <View style={styles.leaderInfo}>
                <Text style={styles.leaderName}>{entry.wallet_address}</Text>
                <Text style={styles.leaderVectors}>
                  {entry.total_vectors.toLocaleString()} vectors
                </Text>
              </View>
              <Text style={styles.leaderHix}>{entry.earned_hix.toFixed(4)} HIX</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Permissions</Text>
          <PermissionRow label="Motion Sensors" granted={permissionsGranted.motion} />
          <PermissionRow label="Location" granted={permissionsGranted.location} />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const PermissionRow = ({ label, granted }) => (
  <View style={styles.permissionRow}>
    <Text style={styles.permissionLabel}>{label}</Text>
    <Text style={[styles.permissionStatus, granted && styles.permissionGranted]}>
      {granted ? '✓ Granted' : '✗ Not Granted'}
    </Text>
  </View>
);

const MISSIONS = [
  { name: 'General Mining', icon: '⚙️', multiplier: 1.0 },
  { name: 'Walking', icon: '🚶', multiplier: 1.2 },
  { name: 'Running', icon: '🏃', multiplier: 1.5 },
  { name: 'Exercise', icon: '💪', multiplier: 1.8 },
  { name: 'Tool Usage', icon: '🔧', multiplier: 2.0 },
  { name: 'Typing', icon: '⌨️', multiplier: 1.7 },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1B',
  },
  header: {
    padding: 30,
    paddingTop: 60,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  logo: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  networkPulse: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  pulseItem: {
    alignItems: 'center',
  },
  pulseValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFF',
  },
  pulseLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    margin: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 15,
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 15,
    color: '#FFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
  },
  earningsCard: {
    padding: 30,
    margin: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  earningsValue: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 15,
  },
  earningsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  earningsStat: {
    fontSize: 13,
    color: '#818CF8',
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 15,
    paddingHorizontal: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#10B981',
  },
  taskGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  taskButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    padding: 15,
    width: (width - 70) / 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  taskButtonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    borderColor: '#6366F1',
  },
  taskIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  taskName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  taskMultiplier: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '900',
  },
  mineButton: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  mineButtonGradient: {
    padding: 20,
    alignItems: 'center',
  },
  mineButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  leaderEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    marginBottom: 10,
  },
  leaderEntryHighlight: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  leaderRank: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFD700',
    width: 50,
  },
  leaderInfo: {
    flex: 1,
  },
  leaderName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  leaderVectors: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  leaderHix: {
    fontSize: 16,
    fontWeight: '900',
    color: '#10B981',
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  permissionLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  permissionStatus: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  permissionGranted: {
    color: '#10B981',
  },
});