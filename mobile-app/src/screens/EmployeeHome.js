import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ScrollView, Alert
} from 'react-native';
import { Camera } from 'react-native-camera';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const EmployeeHome = () => {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    loadTodayAttendance();
  }, []);

  const loadTodayAttendance = async () => {
    try {
      const attendance = await api.getTodayAttendance(user._id);
      setTodayAttendance(attendance);
    } catch (error) {
      console.error('Failed to load attendance:', error);
    }
  };

  const handleFaceCapture = async (imageData) => {
    setCapturedImage(imageData);
    setCameraVisible(false);

    // Verify with backend
    try {
      const result = await api.verifyFace(user._id, imageData);

      if (result.verified) {
        Alert.alert('Success', 'Face verified successfully');
        loadTodayAttendance();
      } else {
        Alert.alert('Failed', 'Face not recognized. Please try again.');
        setCapturedImage(null);
      }
    } catch (error) {
      Alert.alert('Error', 'Verification failed');
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      const data = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5
      });
      handleFaceCapture(data);
    }
  };

  const renderAttendanceCard = () => {
    if (!todayAttendance) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Attendance</Text>
          <TouchableOpacity
            style={styles.checkInButton}
            onPress={() => setCameraVisible(true)}
          >
            <Text style={styles.buttonText}>Check In</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.card}>
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
    <ScrollView style={styles.container}>
      {/* User Profile Header */}
      <View style={styles.header}>
        <Image
          source={{ uri: user.profilePicture }}
          style={styles.profilePic}
        />
        <View>
          <Text style={styles.userName}>{user.firstName} {user.lastName}</Text>
          <Text style={styles.userId}>{user.employeeId}</Text>
        </View>
      </View>

      {/* Attendance Card */}
      {renderAttendanceCard()}

      {/* Monthly Summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Monthly Summary</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>22</Text>
            <Text>Present</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>2</Text>
            <Text>Late</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>$50</Text>
            <Text>Fines</Text>
          </View>
        </View>
      </View>

      {/* Recent Fines */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Fines</Text>
        {/* List of recent fines */}
      </View>

      {/* Camera Modal */}
      {cameraVisible && (
        <View style={styles.cameraContainer}>
          <Camera
            style={styles.camera}
            type={Camera.Constants.Type.front}
            captureAudio={false}
            ref={cameraRef}
          >
            <TouchableOpacity
              style={styles.captureButton}
              onPress={takePicture}
            >
              <View style={styles.captureInner} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setCameraVisible(false)}
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
