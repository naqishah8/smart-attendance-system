import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ScrollView, Alert, ActivityIndicator, Platform, PermissionsAndroid
} from 'react-native';
import { Camera } from 'react-native-camera';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const MAX_IMAGE_SIZE_BYTES = 500 * 1024; // 500KB

const EmployeeHome = () => {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState({
    present: 0,
    late: 0,
    fines: 0
  });
  const [summaryLoading, setSummaryLoading] = useState(true);
  const cameraRef = useRef(null);

  useEffect(() => {
    loadTodayAttendance();
    loadMonthlySummary();
  }, []);

  const loadTodayAttendance = async () => {
    try {
      setLoading(true);
      const attendance = await api.getTodayAttendance(user._id);
      setTodayAttendance(attendance);
    } catch (error) {
      // Silently handle - user will see "Check In" option
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlySummary = async () => {
    try {
      setSummaryLoading(true);
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const summary = await api.getMonthlySummary?.(user._id, month, year)
        || await api.getAttendanceHistory?.(
          user._id,
          new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
          now.toISOString().split('T')[0]
        );
      if (summary) {
        setMonthlySummary({
          present: summary.present ?? summary.daysPresent ?? 0,
          late: summary.late ?? summary.daysLate ?? 0,
          fines: summary.fines ?? summary.totalFines ?? 0
        });
      }
    } catch (error) {
      // Fall back to defaults already set in state
    } finally {
      setSummaryLoading(false);
    }
  };

  const requestCameraPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs camera access for face verification.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      // iOS permissions are handled via Info.plist
      return true;
    } catch (err) {
      Alert.alert('Permission Error', 'Failed to request camera permission. Please enable it in Settings.');
      return false;
    }
  };

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (hasPermission) {
      setCameraVisible(true);
    } else {
      Alert.alert(
        'Camera Permission Required',
        'Please grant camera permission in your device settings to use face verification.'
      );
    }
  };

  const compressImage = async (imageData) => {
    // If the base64 data is already within the limit, return as-is
    if (imageData.base64) {
      const sizeInBytes = (imageData.base64.length * 3) / 4;
      if (sizeInBytes <= MAX_IMAGE_SIZE_BYTES) {
        return imageData;
      }
    }

    // Re-capture with lower quality if too large
    if (cameraRef.current) {
      let quality = 0.3;
      let compressed = await cameraRef.current.takePictureAsync({
        base64: true,
        quality
      });

      const compressedSize = (compressed.base64.length * 3) / 4;
      if (compressedSize > MAX_IMAGE_SIZE_BYTES && quality > 0.1) {
        compressed = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.1
        });
      }

      return compressed;
    }

    return imageData;
  };

  const handleFaceCapture = async (imageData) => {
    setCameraVisible(false);
    setVerifying(true);

    try {
      // Compress image before uploading
      const compressedData = await compressImage(imageData);
      setCapturedImage(compressedData);

      const result = await api.verifyFace(user._id, compressedData);

      if (result.verified) {
        Alert.alert('Success', 'Face verified successfully');
        loadTodayAttendance();
      } else {
        Alert.alert('Failed', 'Face not recognized. Please try again.');
        setCapturedImage(null);
      }
    } catch (error) {
      Alert.alert('Error', 'Verification failed. Please check your connection and try again.');
      setCapturedImage(null);
    } finally {
      setVerifying(false);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const data = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.5
        });
        handleFaceCapture(data);
      } catch (error) {
        Alert.alert('Error', 'Failed to capture photo. Please try again.');
      }
    }
  };

  const renderAttendanceCard = () => {
    if (loading) {
      return (
        <View style={styles.card} accessibilityLabel="Loading attendance">
          <Text style={styles.cardTitle}>Today's Attendance</Text>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      );
    }

    if (!todayAttendance) {
      return (
        <View style={styles.card} accessibilityLabel="Today's attendance - not checked in">
          <Text style={styles.cardTitle}>Today's Attendance</Text>
          <TouchableOpacity
            style={styles.checkInButton}
            onPress={openCamera}
            disabled={verifying}
            accessibilityLabel="Check in with face verification"
            accessibilityRole="button"
          >
            {verifying ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.buttonText}>Check In</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.card} accessibilityLabel="Today's attendance details">
        <Text style={styles.cardTitle}>Today's Attendance</Text>
        <View style={styles.statusRow}>
          <Text>Status: </Text>
          <Text style={[
            styles.status,
            { color: todayAttendance.status === 'present' ? 'green' : 'orange' }
          ]}>
            {todayAttendance.status}
          </Text>
        </View>
        <Text>Check In: {todayAttendance.firstDetection ?
          new Date(todayAttendance.firstDetection).toLocaleTimeString() : '--:--'}
        </Text>
        <Text>Check Out: {todayAttendance.lastDetection ?
          new Date(todayAttendance.lastDetection).toLocaleTimeString() : '--:--'}
        </Text>
        <Text>Hours: {todayAttendance.effectiveWorkHours?.toFixed(1) || 0}h</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} accessibilityLabel="Employee home screen">
      {/* User Profile Header */}
      <View style={styles.header} accessibilityLabel={`Profile: ${user.firstName} ${user.lastName}`}>
        <Image
          source={{ uri: user.profilePicture }}
          style={styles.profilePic}
          accessibilityLabel="Profile picture"
        />
        <View>
          <Text style={styles.userName}>{user.firstName} {user.lastName}</Text>
          <Text style={styles.userId}>{user.employeeId}</Text>
        </View>
      </View>

      {/* Attendance Card */}
      {renderAttendanceCard()}

      {/* Monthly Summary */}
      <View style={styles.card} accessibilityLabel="Monthly attendance summary">
        <Text style={styles.cardTitle}>Monthly Summary</Text>
        {summaryLoading ? (
          <ActivityIndicator size="small" color="#4CAF50" />
        ) : (
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem} accessibilityLabel={`${monthlySummary.present} days present`}>
              <Text style={styles.summaryValue}>{monthlySummary.present}</Text>
              <Text>Present</Text>
            </View>
            <View style={styles.summaryItem} accessibilityLabel={`${monthlySummary.late} days late`}>
              <Text style={styles.summaryValue}>{monthlySummary.late}</Text>
              <Text>Late</Text>
            </View>
            <View style={styles.summaryItem} accessibilityLabel={`$${monthlySummary.fines} in fines`}>
              <Text style={styles.summaryValue}>${monthlySummary.fines}</Text>
              <Text>Fines</Text>
            </View>
          </View>
        )}
      </View>

      {/* Recent Fines */}
      <View style={styles.card} accessibilityLabel="Recent fines">
        <Text style={styles.cardTitle}>Recent Fines</Text>
        {/* List of recent fines */}
      </View>

      {/* Camera Modal */}
      {cameraVisible && (
        <View style={styles.cameraContainer} accessibilityLabel="Face verification camera">
          <Camera
            style={styles.camera}
            type={Camera.Constants.Type.front}
            captureAudio={false}
            ref={cameraRef}
          >
            <TouchableOpacity
              style={styles.captureButton}
              onPress={takePicture}
              accessibilityLabel="Take photo for face verification"
              accessibilityRole="button"
            >
              <View style={styles.captureInner} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setCameraVisible(false)}
              accessibilityLabel="Close camera"
              accessibilityRole="button"
            >
              <Text style={styles.closeText}>X</Text>
            </TouchableOpacity>
          </Camera>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'white',
    alignItems: 'center'
  },
  profilePic: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  userId: {
    color: '#666'
  },
  card: {
    backgroundColor: 'white',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    elevation: 2
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10
  },
  checkInButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold'
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5
  },
  status: {
    fontWeight: 'bold',
    textTransform: 'capitalize'
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10
  },
  summaryItem: {
    alignItems: 'center'
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  cameraContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black'
  },
  camera: {
    flex: 1
  },
  captureButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white'
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeText: {
    color: 'white',
    fontSize: 20
  }
});

export default EmployeeHome;
