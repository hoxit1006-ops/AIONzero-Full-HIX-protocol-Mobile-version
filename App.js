import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const STORAGE_KEY = 'receipt_tracker_data_v1';
const CATEGORIES = ['Groceries', 'Dining', 'Transport', 'Shopping', 'Bills', 'Health', 'Other'];

const emptyItem = { name: '', price: '', quantity: '1', category: 'Other' };

export default function App() {
  const [receipts, setReceipts] = useState([]);
  const [merchant, setMerchant] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [imageUri, setImageUri] = useState('');
  const [imageReference, setImageReference] = useState('');
  const [items, setItems] = useState([emptyItem]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(receipts)).catch(() => {
      console.log('Unable to save receipts');
    });
  }, [receipts]);

  async function loadData() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setReceipts(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Load error', error);
    }
  }

  async function pickImage() {
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Expo Go note',
        'Direct photo upload in this build works on web. In Expo Go, paste a photo/cloud link in "Photo reference" so you can still track spending on the go.'
      );
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        const objectUrl = URL.createObjectURL(file);
        setImageUri(objectUrl);
        setImageReference(file.name);
      }
    };

    input.click();
  }

  function addItemRow() {
    setItems((prev) => [...prev, emptyItem]);
  }

  function removeItemRow(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index, key, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function calculateReceiptTotal(receiptItems) {
    return receiptItems.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      return sum + qty * price;
    }, 0);
  }

  function saveReceipt() {
    if (!merchant.trim()) {
      Alert.alert('Missing merchant', 'Please enter where you shopped.');
      return;
    }

    const validItems = items.filter((item) => item.name.trim() && Number(item.price) > 0);

    if (!validItems.length) {
      Alert.alert('Missing items', 'Add at least one item with a price.');
      return;
    }

    const normalizedItems = validItems.map((item) => ({
      ...item,
      price: Number(item.price),
      quantity: Number(item.quantity || 1),
    }));

    const newReceipt = {
      id: String(Date.now()),
      merchant: merchant.trim(),
      purchaseDate,
      imageUri,
      imageReference: imageReference.trim(),
      items: normalizedItems,
      total: calculateReceiptTotal(normalizedItems),
      createdAt: new Date().toISOString(),
    };

    setReceipts((prev) => [newReceipt, ...prev]);
    setMerchant('');
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setImageUri('');
    setImageReference('');
    setItems([emptyItem]);
  }

  const totalSpent = useMemo(() => receipts.reduce((sum, receipt) => sum + Number(receipt.total || 0), 0), [receipts]);

  const spendingByCategory = useMemo(() => {
    const result = {};
    receipts.forEach((receipt) => {
      receipt.items.forEach((item) => {
        const key = item.category || 'Other';
        result[key] = (result[key] || 0) + Number(item.price || 0) * Number(item.quantity || 1);
      });
    });
    return result;
  }, [receipts]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Receipt Spending Tracker</Text>
        <Text style={styles.subheading}>Upload receipts, track items, and see where your money goes.</Text>
        <Text style={styles.connectionTip}>
          {Platform.OS === 'web'
            ? 'Web mode: you can upload receipt photos directly.'
            : 'Expo Go mode: enter items now and attach a photo link in Photo reference.'}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add Receipt</Text>
          <TextInput
            style={styles.input}
            placeholder="Store name (example: Target)"
            placeholderTextColor="#888"
            value={merchant}
            onChangeText={setMerchant}
          />
          <TextInput
            style={styles.input}
            placeholder="Purchase date (YYYY-MM-DD)"
            placeholderTextColor="#888"
            value={purchaseDate}
            onChangeText={setPurchaseDate}
          />

          <TextInput
            style={styles.input}
            placeholder="Photo reference (iCloud/Drive link or note)"
            placeholderTextColor="#888"
            value={imageReference}
            onChangeText={setImageReference}
          />

          <TouchableOpacity style={styles.secondaryButton} onPress={pickImage}>
            <Text style={styles.secondaryButtonText}>{imageUri ? 'Change Receipt Photo' : 'Upload Receipt Photo'}</Text>
          </TouchableOpacity>

          {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImage} /> : null}

          <Text style={styles.sectionLabel}>Items on receipt</Text>
          {items.map((item, index) => (
            <View style={styles.itemRow} key={`item-${index}`}>
              <TextInput
                style={styles.input}
                placeholder="Item name"
                placeholderTextColor="#888"
                value={item.name}
                onChangeText={(value) => updateItem(index, 'name', value)}
              />
              <View style={styles.rowInline}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Price"
                  placeholderTextColor="#888"
                  keyboardType="decimal-pad"
                  value={String(item.price)}
                  onChangeText={(value) => updateItem(index, 'price', value)}
                />
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Qty"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                  value={String(item.quantity)}
                  onChangeText={(value) => updateItem(index, 'quantity', value)}
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroller}>
                {CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={`${index}-${category}`}
                    style={[
                      styles.categoryPill,
                      item.category === category ? styles.categoryPillActive : null,
                    ]}
                    onPress={() => updateItem(index, 'category', category)}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        item.category === category ? styles.categoryPillTextActive : null,
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {items.length > 1 ? (
                <TouchableOpacity onPress={() => removeItemRow(index)}>
                  <Text style={styles.removeText}>Remove item</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}

          <TouchableOpacity style={styles.secondaryButton} onPress={addItemRow}>
            <Text style={styles.secondaryButtonText}>+ Add another item</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={saveReceipt}>
            <Text style={styles.primaryButtonText}>Save Receipt</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending Summary</Text>
          <Text style={styles.summaryTotal}>Total Spent: ${totalSpent.toFixed(2)}</Text>
          {Object.keys(spendingByCategory).length === 0 ? (
            <Text style={styles.summaryLine}>No spending yet. Add your first receipt above.</Text>
          ) : (
            Object.entries(spendingByCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([category, amount]) => (
                <Text style={styles.summaryLine} key={category}>
                  {category}: ${amount.toFixed(2)}
                </Text>
              ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Receipt History</Text>
          {receipts.length === 0 ? (
            <Text style={styles.summaryLine}>No receipts uploaded yet.</Text>
          ) : (
            receipts.map((receipt) => (
              <View style={styles.receiptCard} key={receipt.id}>
                <Text style={styles.receiptMerchant}>{receipt.merchant}</Text>
                <Text style={styles.receiptMeta}>{receipt.purchaseDate}</Text>
                <Text style={styles.receiptMeta}>Total: ${Number(receipt.total).toFixed(2)}</Text>
                {receipt.imageReference ? <Text style={styles.receiptMeta}>Photo ref: {receipt.imageReference}</Text> : null}
                {receipt.items.map((item, index) => (
                  <Text style={styles.receiptItem} key={`${receipt.id}-${index}`}>
                    • {item.name} ({item.category}) x{item.quantity} - ${Number(item.price).toFixed(2)}
                  </Text>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subheading: {
    fontSize: 15,
    color: '#cbd5e1',
    marginTop: -8,
  },
  connectionTip: {
    color: '#93c5fd',
    fontSize: 13,
    marginTop: -8,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowInline: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#052e16',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
  },
  sectionLabel: {
    color: '#cbd5e1',
    fontSize: 14,
    marginTop: 8,
  },
  itemRow: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  categoryScroller: {
    flexGrow: 0,
  },
  categoryPill: {
    borderWidth: 1,
    borderColor: '#64748b',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  categoryPillText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  categoryPillTextActive: {
    color: '#052e16',
    fontWeight: '700',
  },
  removeText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryTotal: {
    color: '#86efac',
    fontSize: 18,
    fontWeight: '700',
  },
  summaryLine: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  receiptCard: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 10,
    gap: 4,
    marginBottom: 8,
  },
  receiptMerchant: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  receiptMeta: {
    color: '#94a3b8',
    fontSize: 13,
  },
  receiptItem: {
    color: '#e2e8f0',
    fontSize: 13,
  },
});
